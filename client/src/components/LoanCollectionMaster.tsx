import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { PlusCircle, Search, Save, Edit, Trash2, X, FileText, CheckSquare, Printer, Calendar, CheckCircle, AlertCircle, Clock, Layers, CreditCard, ArrowRight, Building2, Award } from 'lucide-react';
import CustomerSearchSelect from './common/CustomerSearchSelect';
import LoanCollectionReceiptPrint from './LoanCollectionReceiptPrint';
import { useAuth } from '../context/AuthContext';

export interface LoanCollectionMasterProps {
    onNavigate?: (tab: string, params?: any) => void;
}

export const format14DigitDisplay = (num?: string) => {
    if (!num) return '-';
    const clean = num.replace(/\D/g, '');
    if (clean.length === 14) {
        return `${clean.substring(0, 3)}-${clean.substring(3, 3)}-${clean.substring(6, 7)}-${clean.substring(13, 1)}`;
    }
    return num;
};

interface LoanAccount {
    loanAccountID: number;
    loanAccountNo: string;
    branchID?: number;
    branch?: {
        branchID: number;
        branchName: string;
        branchCode: string;
    };
    memberID: number;
    customerID?: number;
    sanctionedAmount: number;
    principalBalance: number;
    interestBalance: number;
    overdueInterestBalance: number;
    installmentAmount: number;
    member?: {
        firstName: string;
        lastName: string;
        memberCode?: string;
    };
    customer?: {
        customerID?: number;
        firstName?: string;
        middleName?: string;
        lastName?: string;
        cifNo?: string;
        mobileNo?: string;
    };
    loanRateID?: number;
    legacyAccountNumber?: string;
    loanRate?: {
        loanRateID?: number;
        loanType: string;
        loanCode?: string;
        shortName?: string;
        interestRate?: number;
        interestCalculationMethod?: string;
        loanInstallmentType?: string;
        interestPostingFrequency?: string;
        securityType?: string;
    };
    interestRate?: number;
    loanDisbursementDate?: string;
    lastInstallmentPaidDate?: string;
    lastInterestPostingDate?: string;
    openingDate: string;
    maturityDate: string;
    isOpeningBalance?: boolean;
}

interface LoanInstallmentScheduleDto {
    installmentNo: number;
    dueDate: string;
    principalAmount: number;
    interestAmount: number;
    totalAmount: number;
    status: string;
    paidDate?: string;
    openingBalance?: number;
    closingBalance?: number;
    days?: number;
    interestRate?: number;
    paidPrincipal?: number;
    paidInterest?: number;
    remainingPrincipal?: number;
    overdueDays?: number;
    receiptNo?: string;
}

interface LoanTrancheDetail {
    disbursementID: number;
    disbursementDate: string;
    disbursementAmount: number;
    paymentMode: string;
    netAmountPaid: number;
}

interface AccountDetailsAndSchedule {
    sanctionedAmount: number;
    disbursementDate: string;
    march31Balance: number;
    isOpeningBalance: boolean;
    currentPrincipalBalance: number;
    currentInterestBalance: number;
    currentOverdueInterestBalance: number;
    totalDisbursedAmount?: number;
    disbursementCount?: number;
    pendingSanctionedAmount?: number;
    lastInstallmentPaidDate?: string;
    lastInterestPostingDate?: string;
    tranches?: LoanTrancheDetail[];
    schedule: LoanInstallmentScheduleDto[];
}

interface Ledger {
    ledgerID: number;
    ledgerName: string;
    accountGroup?: {
        groupID: number;
        groupName: string;
    };
}

interface LoanCollectionFee {
    loanCollectionFeeID?: number;
    loanCollectionID?: number;
    ledgerID: number;
    amount: number;
    ledger?: Ledger;
}

interface LoanCollection {
    loanCollectionID: number;
    loanAccountID: number;
    branchID?: number;
    collectingCashierID?: number;
    createdByUserID?: number;
    isCrossBranch?: boolean;
    homeBranchID?: number;
    branch?: any;
    collectionDate: string;
    receiptNo: string;
    totalAmountReceived: number;
    surchargeCollected: number;
    penaltyInterestCollected: number;
    receivableInterestCollected?: number;
    interestCollected: number;
    principalCollected: number;
    interestWaived?: number;
    penaltyWaived?: number;
    isOTS?: boolean;
    resolutionNo?: string;
    approvedByUserID?: number;
    paymentMode: string;
    bankName?: string;
    chequeNo?: string;
    bankAccountLedgerID?: number;
    transferFromSavingAccountNo?: string;
    remarks?: string;
    loanAccount?: LoanAccount;
    fees?: LoanCollectionFee[];
}

const parseDateSafe = (dateVal: string | Date | undefined | null): Date => {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? new Date() : dateVal;
    const str = String(dateVal).trim();
    if (!str) return new Date();
    // Normalize dots to colons in ISO time (e.g. T00.00.00 -> T00:00:00)
    const cleanStr = str.replace(/T(\d{2})\.(\d{2})\.(\d{2})/, 'T$1:$2:$3');
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) return d;
    // Format YYYY-MM-DD
    const matchYmd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (matchYmd) {
        return new Date(parseInt(matchYmd[1], 10), parseInt(matchYmd[2], 10) - 1, parseInt(matchYmd[3], 10));
    }
    // Format DD-MM-YYYY or DD/MM/YYYY
    const matchDmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (matchDmy) {
        return new Date(parseInt(matchDmy[3], 10), parseInt(matchDmy[2], 10) - 1, parseInt(matchDmy[1], 10));
    }
    return new Date();
};

const formatDateSafe = (dateVal: string | Date | undefined | null): string => {
    if (!dateVal) return '-';
    if (dateVal instanceof Date) {
        return isNaN(dateVal.getTime()) ? '-' : dateVal.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    const str = String(dateVal).trim();
    if (!str) return '-';
    // Check if ISO with dots or colons
    const cleanStr = str.replace(/T(\d{2})\.(\d{2})\.(\d{2})/, 'T$1:$2:$3');
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    // Check YYYY-MM-DD
    const matchYmd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (matchYmd) {
        return `${matchYmd[3].padStart(2, '0')}/${matchYmd[2].padStart(2, '0')}/${matchYmd[1]}`;
    }
    // Check DD-MM-YYYY
    const matchDmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (matchDmy) {
        return `${matchDmy[1].padStart(2, '0')}/${matchDmy[2].padStart(2, '0')}/${matchDmy[3]}`;
    }
    return str;
};

interface LienReleasePrompt {
    loanAccountId: number;
    loanAccountNo: string;
    activeCollaterals: Array<{
        collateralID: number;
        depositAccountNo: string;
        collateralType: string;
        depositAccountID: number;
        lienAmount: number;
        lienStatus: string;
    }>;
    collectionId?: number;
}

const LoanCollectionMaster: React.FC<LoanCollectionMasterProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];
    const isHOUser = user?.role === 'Admin' || user?.role === 'SuperAdmin' || user?.role === 'HeadOffice' || user?.role === 'HO_Manager';

    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number>(user?.branchID || 1);

    const [collections, setCollections] = useState<LoanCollection[]>([]);
    const [accounts, setAccounts] = useState<LoanAccount[]>([]);
    const [ledgers, setLedgers] = useState<Ledger[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Passing Mode State (व्हाउचर तपासणी व मंजुरी मोड)
    const [isPassingMode, setIsPassingMode] = useState(false);
    const [passingVoucherId, setPassingVoucherId] = useState<number | null>(null);
    const [passingCollection, setPassingCollection] = useState<LoanCollection | null>(null);
    const [passingVoucher, setPassingVoucher] = useState<any | null>(null);
    const [passingActionLoading, setPassingActionLoading] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    
    // Printing state
    const [lastSavedCollectionId, setLastSavedCollectionId] = useState<number | null>(null);
    const [printingCollectionId, setPrintingCollectionId] = useState<number | null>(null);

    // Lien release on loan closure prompt state
    const [lienPromptData, setLienPromptData] = useState<LienReleasePrompt | null>(null);
    const [releasingLien, setReleasingLien] = useState(false);

    // View All Receipts Modal State
    const [showReceiptsModal, setShowReceiptsModal] = useState(false);
    const [editingReceiptId, setEditingReceiptId] = useState<number | null>(null);
    const [editData, setEditData] = useState<any>({});

    // Installment Schedule Modal State
    const [showInstallmentModal, setShowInstallmentModal] = useState(false);
    const [modalFilter, setModalFilter] = useState<'ALL' | 'OVERDUE' | 'PENDING' | 'PAID' | 'PARTIAL'>('ALL');
    const [isSchedulePrintView, setIsSchedulePrintView] = useState(false);

    const [formData, setFormData] = useState<Partial<LoanCollection>>({
        collectionDate: activeBusinessDate,
        receiptNo: '',
        paymentMode: "Cash",
        totalAmountReceived: 0,
        surchargeCollected: 0,
        penaltyInterestCollected: 0,
        receivableInterestCollected: 0,
        interestCollected: 0,
        principalCollected: 0,
        fees: []
    });

    useEffect(() => {
        if (user?.businessDate) {
            setFormData(prev => ({ ...prev, collectionDate: user.businessDate.split('T')[0] }));
        }
    }, [user?.businessDate]);

    const [customerMatchingLoans, setCustomerMatchingLoans] = useState<LoanAccount[]>([]);
    const [showMultiLoanModal, setShowMultiLoanModal] = useState(false);
    const [multiLoanCustomerInfo, setMultiLoanCustomerInfo] = useState<{
        name: string;
        cifNo: string;
        customerId?: number;
    } | null>(null);
    const [noLoanFoundAlert, setNoLoanFoundAlert] = useState<string | null>(null);

    const [selectedAccount, setSelectedAccount] = useState<LoanAccount | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [selectedBorrowerKey, setSelectedBorrowerKey] = useState<string | null>(null);
    const [selectedSchemeId, setSelectedSchemeId] = useState<number | null>(null);
    const [accountDetails, setAccountDetails] = useState<AccountDetailsAndSchedule | null>(null);
    const [npaStatus, setNpaStatus] = useState<{ category: string, overdueDays: number, categoryMarathi: string } | null>(null);
    const [todayTotalCash, setTodayTotalCash] = useState(0);
    const [todayTotalBank, setTodayTotalBank] = useState(0);
    const [sanstha, setSanstha] = useState<any>(null);

    const fetchSanstha = async () => {
        try {
            const res = await axios.get('/api/SansthaDetails');
            if (res.data && res.data.length > 0) {
                setSanstha(res.data[0]);
            }
        } catch (err) {
            console.error("Failed to fetch sanstha details", err);
        }
    };

    // 1. Available Loan Schemes (कर्ज प्रकार / योजना) - Scheme Name only
    const availableLoanSchemes = useMemo(() => {
        const schemeMap = new Map<number, { id: number; name: string }>();
        accounts.forEach((a: any) => {
            const rId = a.loanRateID || a.loanRate?.loanRateID;
            if (rId) {
                const name = a.loanRate?.shortName || a.loanRate?.loanType || `योजना #${rId}`;
                if (!schemeMap.has(rId)) {
                    schemeMap.set(rId, { id: rId, name });
                }
            }
        });
        return Array.from(schemeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [accounts]);

    // 2. Filter accounts by selected loan scheme (empty if no scheme selected to prevent software lag)
    const filteredAccountsForBorrowers = useMemo(() => {
        if (!selectedSchemeId) return [];
        return accounts.filter((a: any) => {
            const rId = a.loanRateID || a.loanRate?.loanRateID;
            return Number(rId) === Number(selectedSchemeId);
        });
    }, [accounts, selectedSchemeId]);

    // 3. Extract unique borrowers (Customers) from active loan accounts filtered by selected loan scheme
    const borrowerCustomers = useMemo(() => {
        if (!selectedSchemeId) return [];
        const map = new Map<number, any>();
        filteredAccountsForBorrowers.forEach((a: any) => {
            const custId = Number(a.customerID || a.customer?.customerID || a.memberID || 0);
            if (custId <= 0) return;

            const legacyAccNo = (a.legacyAccountNumber || '').trim();
            const currentAccNo = (a.loanAccountNo || '').trim();

            if (!map.has(custId)) {
                let fName = '';
                let mName = '';
                let lName = '';
                let fullName = '';
                let cif = '';
                let legacyCust = '';
                let mobile = '';

                if (a.customer) {
                    fName = a.customer.firstName || '';
                    mName = a.customer.middleName || '';
                    lName = a.customer.lastName || '';
                    fullName = [fName, mName, lName].filter(Boolean).join(' ').trim();
                    cif = a.customer.cifNo || '';
                    legacyCust = a.customer.legacyCustomerNo || '';
                    mobile = a.customer.mobileNo || '';
                } else if (a.member) {
                    fName = a.member.firstName || '';
                    mName = a.member.middleName || '';
                    lName = a.member.lastName || '';
                    fullName = [fName, mName, lName].filter(Boolean).join(' ').trim();
                    cif = a.member.memberCode || '';
                } else {
                    fName = 'खातेदार';
                    lName = `#${custId}`;
                    fullName = `खातेदार #${custId}`;
                    cif = a.loanAccountNo || '';
                    legacyCust = a.legacyAccountNumber || '';
                }

                map.set(custId, {
                    customerID: custId,
                    cifNo: cif,
                    legacyCustomerNo: legacyCust,
                    legacyLoanAccountNos: legacyAccNo ? [legacyAccNo] : [],
                    loanAccountNos: currentAccNo ? [currentAccNo] : [],
                    firstName: fName,
                    middleName: mName,
                    lastName: lName,
                    fullName: fullName || `खातेदार #${custId}`,
                    mobileNo: mobile
                });
            } else {
                const existing = map.get(custId);
                if (legacyAccNo && !existing.legacyLoanAccountNos.includes(legacyAccNo)) {
                    existing.legacyLoanAccountNos.push(legacyAccNo);
                }
                if (currentAccNo && !existing.loanAccountNos.includes(currentAccNo)) {
                    existing.loanAccountNos.push(currentAccNo);
                }
            }
        });

        const result = Array.from(map.values()).map(item => ({
            ...item,
            legacyLoanAccountNo: item.legacyLoanAccountNos.join(', '),
            loanAccountNo: item.loanAccountNos.join(', ')
        }));

        return result.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    }, [filteredAccountsForBorrowers, selectedSchemeId]);

    // Backward-compat alias
    const borrowerOptions = borrowerCustomers;

    // 4. Loans of selected borrower, filtered by selected loan scheme
    const borrowerLoans = useMemo(() => {
        if (!selectedBorrowerKey && !selectedCustomerId) return [];
        return accounts.filter((a: any) => {
            const custId = Number(a.customerID || a.customer?.customerID || a.memberID || 0);
            const belongsToBorrower = (selectedCustomerId && custId === Number(selectedCustomerId)) ||
                   (selectedBorrowerKey && (
                       selectedBorrowerKey === `C_${custId}` || 
                       selectedBorrowerKey === `M_${a.memberID}` || 
                       selectedBorrowerKey === `ACC_${a.loanAccountID}`
                   ));
            if (!belongsToBorrower) return false;
            if (selectedSchemeId) {
                const rId = a.loanRateID || a.loanRate?.loanRateID;
                return Number(rId) === Number(selectedSchemeId);
            }
            return true;
        });
    }, [accounts, selectedBorrowerKey, selectedCustomerId, selectedSchemeId]);
    const memberLoans = borrowerLoans;

    const bankLedgers = ledgers.filter((l: any) => {
        if (!l) return false;
        const gId = l.groupID || l.accountGroupID || 0;
        const parentGId = l.accountGroup?.parentGroupID || 0;
        const gName = (l.accountGroup?.groupName || '').toLowerCase();
        const lName = (l.ledgerName || '').toLowerCase();
        const accType = (l.accountType || '').toLowerCase();

        return (
            gId === 32 || gId === 33 || gId === 34 ||
            parentGId === 32 ||
            gName.includes('बँक') || gName.includes('bank') ||
            gName.includes('करंट') || gName.includes('current') ||
            gName.includes('चालू') || gName.includes('शिल्लक') ||
            lName.includes('बँक') || lName.includes('bank') ||
            lName.includes('करंट') || lName.includes('current') ||
            lName.includes('चालू') ||
            accType.includes('bank') || accType.includes('current')
        );
    });

    const fetchBranches = async () => {
        try {
            const res = await axios.get('/api/Branches');
            setBranches(res.data || []);
        } catch (err) {
            console.error("Failed to load branches", err);
        }
    };

    const fetchNextReceiptNo = async (targetBranchId?: number, targetAccountId?: number) => {
        try {
            const bId = targetBranchId || selectedBranchId || user?.branchID || 1;
            const url = targetAccountId 
                ? `/api/LoanCollections/next-receipt-no?branchId=${bId}&loanAccountId=${targetAccountId}`
                : `/api/LoanCollections/next-receipt-no?branchId=${bId}`;
            const res = await axios.get(url);
            if (res.data && res.data.receiptNo) {
                setFormData(prev => ({ ...prev, receiptNo: res.data.receiptNo }));
            }
        } catch (err) {
            console.error("Failed to fetch next receipt number", err);
        }
    };

    const loadCollectionForPassing = async (vId: number) => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/LoanCollections/by-voucher/${vId}`);
            const col: LoanCollection = res.data;
            if (!col) {
                alert('या व्हाउचरशी जोडलेली कोणतीही कर्ज वसुली पावती सापडली नाही.');
                return;
            }
            setPassingCollection(col);
            setPassingVoucher((col as any).voucher || null);
            setFormData({
                ...col,
                collectionDate: col.collectionDate ? col.collectionDate.split('T')[0] : new Date().toISOString().split('T')[0],
                fees: col.fees || []
            });
            setLastSavedCollectionId(col.loanCollectionID);

            if (col.loanAccount) {
                const acc = col.loanAccount;
                setSelectedAccount(acc);
                const custId = acc.customerID || acc.customer?.customerID;
                const bKey = custId ? `C_${custId}` : (acc.memberID ? `M_${acc.memberID}` : `ACC_${acc.loanAccountID}`);
                setSelectedBorrowerKey(bKey);
                setSelectedCustomerId(custId || null);
                (window as any).selectedLoanCustomerId = custId;
                (window as any).selectedLoanAccountId = acc.loanAccountID;
                (window as any).selectedLoanMemberId = acc.memberID;

                try {
                    const schedRes = await axios.get(`/api/LoanAccounts/${col.loanAccountID}/AccountDetailsAndSchedule`);
                    if (schedRes.data) {
                        setAccountDetails(schedRes.data);
                    }
                } catch (e) {
                    console.error('Error fetching loan schedule in passing mode:', e);
                }

                try {
                    const npaRes = await axios.get(`/api/Npa/status/${col.loanAccountID}`);
                    if (npaRes.data) {
                        setNpaStatus(npaRes.data);
                    }
                } catch (e) {}
            }
        } catch (err: any) {
            console.error('Failed to load collection for passing:', err);
            alert('कर्ज वसुली पावती लोड करताना त्रुटी आली.');
        } finally {
            setLoading(false);
        }
    };

    const handlePassVoucher = async () => {
        const vId = passingVoucher?.voucherID || passingVoucherId;
        const vNo = passingVoucher?.voucherNo || formData.receiptNo;
        if (!vId) {
            alert('व्हाउचर आयडी सापडला नाही.');
            return;
        }

        setPassingActionLoading(true);
        try {
            const payload = {
                voucherIds: [vId],
                approvedBy: user?.userID || 1
            };

            const res = await fetch('/api/VoucherPosting/Post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                const scrollInfo = data.results && data.results[0] ? ` (Scroll No: ${data.results[0].scrollNo})` : '';
                alert(`कर्ज वसुली व्हाउचर क्र. ${vNo} यशस्वीरीत्या पास करण्यात आले!${scrollInfo}`);
                if (onNavigate) {
                    onNavigate('voucher-posting');
                } else {
                    window.location.href = '/?tab=voucher-posting';
                }
            } else {
                const errText = await res.text();
                alert(`त्रुटी: ${errText}`);
            }
        } catch (e) {
            alert('व्हाउचर पास करताना नेटवर्क त्रुटी आली.');
        } finally {
            setPassingActionLoading(false);
        }
    };

    const handleRejectVoucher = async () => {
        const vId = passingVoucher?.voucherID || passingVoucherId;
        const vNo = passingVoucher?.voucherNo || formData.receiptNo;
        if (!vId) return;
        if (!rejectionReason.trim()) {
            alert('कृपया नामंजूर करण्याचे कारण लिहा.');
            return;
        }

        setPassingActionLoading(true);
        try {
            const res = await fetch(`/api/VoucherPosting/${vId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: rejectionReason.trim(),
                    userId: user?.userID || 1,
                    username: user?.username || 'Admin',
                    userRole: user?.roleName || user?.role || 'Admin'
                })
            });

            const resData = await res.json().catch(() => null);
            if (res.ok) {
                alert(resData?.message || `कर्ज वसुली पावती/व्हाउचर क्र. ${vNo} नामंजूर / रद्द करण्यात आले.`);
                setRejectModalOpen(false);
                if (onNavigate) {
                    onNavigate('voucher-posting');
                } else {
                    window.location.href = '/?tab=voucher-posting';
                }
            } else {
                alert(resData?.message || resData || 'व्हाउचर नामंजूर करताना त्रुटी आली.');
            }
        } catch (e) {
            alert('व्हाउचर नामंजूर करताना त्रुटी आली.');
        } finally {
            setPassingActionLoading(false);
        }
    };

    useEffect(() => {
        fetchSanstha();
        fetchBranches();
        fetchData();
        fetchAccounts();
        fetchLedgers();

        const params = new URLSearchParams(window.location.search);
        const mode = params.get('passingMode');
        const vId = params.get('voucherId');
        if (mode === 'true' && vId) {
            setIsPassingMode(true);
            setPassingVoucherId(Number(vId));
            loadCollectionForPassing(Number(vId));
        } else {
            fetchNextReceiptNo(selectedBranchId);
        }

        return () => {
            (window as any).selectedLoanCustomerId = undefined;
            (window as any).selectedLoanAccountId = undefined;
            (window as any).selectedLoanMemberId = undefined;
        };
    }, []);

    const fetchData = async (overrideBranchId?: number) => {
        setLoading(true);
        try {
            const bId = overrideBranchId !== undefined ? overrideBranchId : selectedBranchId;
            const res = await axios.get(`/api/LoanCollections${bId ? `?branchId=${bId}&pageSize=50` : '?pageSize=50'}`);
            setCollections(res.data);
            
            // Calculate today's totals
            const todayStr = new Date().toISOString().split('T')[0];
            let cash = 0;
            let bank = 0;
            res.data.forEach((c: any) => {
                if (c.collectionDate && c.collectionDate.split('T')[0] === todayStr) {
                    if (c.paymentMode === 'Cash') cash += c.totalAmountReceived;
                    else bank += c.totalAmountReceived;
                }
            });
            setTodayTotalCash(cash);
            setTodayTotalBank(bank);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingReceiptId) return;
        try {
            const original = collections.find(c => c.loanCollectionID === editingReceiptId);
            if (!original) return;
            
            const payload = {
                ...original,
                collectionDate: editData.collectionDate,
                paymentMode: editData.paymentMode,
                remarks: editData.remarks
            };
            
            await axios.put(`/api/LoanCollections/${editingReceiptId}`, payload);
            setEditingReceiptId(null);
            alert("पावती यशस्वीरित्या अपडेट झाली!");
            fetchData();
        } catch (err) {
            console.error("Failed to update receipt", err);
            alert("पावती अपडेट करताना त्रुटी आली.");
        }
    };

    const handleDeleteReceipt = async (id: number) => {
        if (window.confirm("तुम्हाला ही पावती खरोखर डिलीट करायची आहे का? (Are you sure you want to delete this receipt?)")) {
            try {
                await axios.delete(`/api/LoanCollections/${id}`);
                alert("पावती यशस्वीरित्या डिलीट झाली!");
                fetchData();
                await fetchAccounts();
                if (selectedAccount) {
                    selectLoanAccountById(selectedAccount.loanAccountID);
                }
            } catch (err: any) {
                console.error("Failed to delete receipt", err);
                alert(err.response?.data?.message || "पावती डिलीट करताना त्रुटी आली.");
            }
        }
    };

    const fetchAccounts = async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            let cifStr = params.get('cifNo') || params.get('cif');
            let customerIdStr = params.get('customerId') || params.get('customerID');
            let memberIdStr = params.get('memberId') || params.get('memberID');
            let loanAccNo = params.get('loanAccountNo');
            let loanAccountIdStr = params.get('loanAccountId') || params.get('accountId');
            let customerNameStr = params.get('customerName');
            let legacyLoanNo = params.get('legacyLoanAccountNo') || params.get('legacyAccNo') || params.get('oldLoanAccountNo') || params.get('oldAccNo');

            // Also check universal sessionStorage transfer bridge
            if (!cifStr && !customerIdStr && !memberIdStr && !loanAccNo && !loanAccountIdStr && !legacyLoanNo) {
                try {
                    const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
                    if (rawBridge) {
                        sessionStorage.removeItem('cbs_active_customer_transfer');
                        const bridgeData = JSON.parse(rawBridge);
                        if (bridgeData) {
                            cifStr = bridgeData.cifNo || bridgeData.cif;
                            customerIdStr = bridgeData.customerId ? String(bridgeData.customerId) : null;
                            memberIdStr = bridgeData.memberId ? String(bridgeData.memberId) : null;
                            loanAccNo = bridgeData.loanAccountNo || loanAccNo;
                            legacyLoanNo = bridgeData.legacyLoanAccountNo || bridgeData.legacyAccountNumber || legacyLoanNo;
                            customerNameStr = bridgeData.customerName || customerNameStr;
                        }
                    }
                } catch (e) {
                    console.error('Failed to read sessionStorage transfer:', e);
                }
            }

            // Safe property extractors
            const getAccCustId = (a: any) => Number(a.customerID ?? a.customerId ?? a.CustomerID ?? a.customer?.customerID ?? 0);
            const getAccMemId = (a: any) => Number(a.memberID ?? a.memberId ?? a.MemberID ?? a.member?.memberID ?? 0);
            const getAccCif = (a: any) => String(a.customer?.cifNo ?? a.cifNo ?? a.CIFNo ?? '').trim().toUpperCase();

            const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
            const mId = memberIdStr ? parseInt(memberIdStr, 10) : 0;
            const targetAccId = loanAccountIdStr ? parseInt(loanAccountIdStr, 10) : 0;
            let fastTrackDone = false;

            // ⚡ FAST-TRACK 1: Direct targeted account ID lookup (~15-20ms)
            if (targetAccId > 0) {
                try {
                    const singleRes = await axios.get(`/api/LoanAccounts/${targetAccId}`);
                    if (singleRes.data && singleRes.data.loanAccountID) {
                        const acc = singleRes.data;
                        setAccounts([acc]);
                        selectLoanAccountById(acc.loanAccountID, [acc]);
                        setCustomerMatchingLoans([acc]);
                        fastTrackDone = true;
                    }
                } catch (err) {
                    console.warn('Fast-track targeted Loan lookup failed, falling back', err);
                }
            }
            // ⚡ FAST-TRACK 2: Direct targeted customer / member ID lookup (~20-30ms)
            else if (cId > 0 || mId > 0) {
                try {
                    const qParam = cId > 0 ? `customerId=${cId}` : `memberId=${mId}`;
                    const custRes = await axios.get(`/api/LoanAccounts?${qParam}`);
                    const active = (custRes.data || []).filter((a: any) => a.status === 'Active');
                    if (active.length > 0) {
                        setAccounts(active);
                        if (active.length === 1) {
                            selectLoanAccountById(active[0].loanAccountID, active);
                            setCustomerMatchingLoans(active);
                            setNoLoanFoundAlert(null);
                        } else {
                            setCustomerMatchingLoans(active);
                            const custName = customerNameStr || (active[0].customer ? `${active[0].customer.firstName || ''} ${active[0].customer.lastName || ''}`.trim() : 'कर्जदार खातेदार');
                            const primaryCif = cifStr || getAccCif(active[0]) || '-';
                            setMultiLoanCustomerInfo({
                                name: custName,
                                cifNo: primaryCif,
                                customerId: cId || getAccCustId(active[0])
                            });
                            const firstCustId = getAccCustId(active[0]);
                            const bKey = firstCustId ? `C_${firstCustId}` : (active[0].memberID ? `M_${active[0].memberID}` : `ACC_${active[0].loanAccountID}`);
                            setSelectedBorrowerKey(bKey);
                            if (firstCustId) setSelectedCustomerId(firstCustId);
                            setShowMultiLoanModal(true);
                            setNoLoanFoundAlert(null);
                        }
                        fastTrackDone = true;
                    }
                } catch (err) {
                    console.warn('Fast-track customer Loan lookup failed, falling back', err);
                }
            }

            if (!fastTrackDone) {
                const res = await axios.get('/api/LoanAccounts');
                const activeAccs = res.data.filter((a: any) => a.status === 'Active');
                setAccounts(activeAccs);

            if (loanAccNo || legacyLoanNo) {
                const cleanLegacy = legacyLoanNo ? legacyLoanNo.trim().toLowerCase() : '';
                const matchedAcc = activeAccs.find((a: any) => 
                    (loanAccNo && a.loanAccountNo === loanAccNo) ||
                    (cleanLegacy && a.legacyAccountNumber && String(a.legacyAccountNumber).trim().toLowerCase() === cleanLegacy)
                );
                if (matchedAcc) {
                    selectLoanAccountById(matchedAcc.loanAccountID, activeAccs);
                    setCustomerMatchingLoans([matchedAcc]);
                }
            } else if (cifStr || customerIdStr || memberIdStr) {
                const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
                const mId = memberIdStr ? parseInt(memberIdStr, 10) : 0;
                const cleanCif = cifStr ? cifStr.trim().toUpperCase() : '';
                const cleanDigits = cleanCif ? cleanCif.replace(/\D/g, '') : '';

                // Tiered CIF-First Matching
                let matched: LoanAccount[] = [];

                // Tier 1: CIF Match
                if (cleanCif) {
                    matched = activeAccs.filter((a: any) => {
                        const aCif = getAccCif(a);
                        if (!aCif) return false;
                        if (aCif === cleanCif) return true;
                        if (cleanDigits && aCif.replace(/\D/g, '') === cleanDigits) return true;
                        return false;
                    });
                }

                // Tier 2: CustomerID Match
                if (matched.length === 0 && cId > 0) {
                    matched = activeAccs.filter((a: any) => getAccCustId(a) === cId);
                }

                // Tier 3: MemberID Match
                if (matched.length === 0 && mId > 0) {
                    matched = activeAccs.filter((a: any) => getAccMemId(a) === mId || getAccCustId(a) === mId);
                }

                if (matched.length === 1) {
                    selectLoanAccountById(matched[0].loanAccountID, activeAccs);
                    setCustomerMatchingLoans(matched);
                    setNoLoanFoundAlert(null);
                } else if (matched.length > 1) {
                    setCustomerMatchingLoans(matched);
                    const custName = customerNameStr || (matched[0].customer ? `${matched[0].customer.firstName || ''} ${matched[0].customer.lastName || ''}`.trim() : (matched[0].member ? `${matched[0].member.firstName || ''} ${matched[0].member.lastName || ''}`.trim() : 'कर्जदार खातेदार'));
                    const primaryCif = cleanCif || getAccCif(matched[0]) || '-';
                    setMultiLoanCustomerInfo({
                        name: custName,
                        cifNo: primaryCif,
                        customerId: cId || getAccCustId(matched[0])
                    });
                    const firstCustId = getAccCustId(matched[0]);
                    const bKey = firstCustId ? `C_${firstCustId}` : (matched[0].memberID ? `M_${matched[0].memberID}` : `ACC_${matched[0].loanAccountID}`);
                    setSelectedBorrowerKey(bKey);
                    if (firstCustId) setSelectedCustomerId(firstCustId);

                    setShowMultiLoanModal(true);
                    setNoLoanFoundAlert(null);
                } else {
                    setCustomerMatchingLoans([]);
                    const identifier = cleanCif ? `CIF: ${cleanCif}` : (cId ? `ID: ${cId}` : `Member: ${mId}`);
                    setNoLoanFoundAlert(`निवडलेल्या खातेदाराचे (${customerNameStr || identifier}) कोणतेही सक्रिय कर्ज खाते आढळले नाही.`);
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
    };

    const fetchLedgers = async () => {
        try {
            const res = await axios.get('/api/Ledgers');
            setLedgers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectLoanFromModal = (acc: LoanAccount) => {
        selectLoanAccountById(acc.loanAccountID);
        setShowMultiLoanModal(false);
    };

    const selectLoanAccountById = async (accId: number, accountList?: LoanAccount[]) => {
        const pool = accountList && accountList.length > 0 ? accountList : accounts;
        const acc = pool.find(a => a.loanAccountID === accId);
        if (!acc) return;

        const accSchemeId = acc.loanRateID || acc.loanRate?.loanRateID;
        if (accSchemeId && selectedSchemeId !== accSchemeId) {
            setSelectedSchemeId(accSchemeId);
        }

        setSelectedAccount(acc);
        const custId = acc.customerID || acc.customer?.customerID;
        const bKey = custId ? `C_${custId}` : (acc.memberID ? `M_${acc.memberID}` : `ACC_${acc.loanAccountID}`);
        setSelectedBorrowerKey(bKey);
        setSelectedCustomerId(custId || null);
        (window as any).selectedLoanCustomerId = custId;
        (window as any).selectedLoanAccountId = acc.loanAccountID;
        (window as any).selectedLoanMemberId = acc.memberID;
        setFormData(p => ({ ...p, loanAccountID: acc.loanAccountID }));
        setAccountDetails(null);
        setNpaStatus(null);

        fetchNextReceiptNo(selectedBranchId, acc.loanAccountID);
        if (acc.loanRate) {
            calculateInterest(acc, formData.collectionDate || new Date().toISOString().split('T')[0]);
        }

        try {
            const res = await axios.get(`/api/LoanAccounts/${accId}/AccountDetailsAndSchedule`);
            if (res.data) {
                setAccountDetails(res.data);
                setSelectedAccount(prev => {
                    if (!prev || prev.loanAccountID !== accId) return prev;
                    return {
                        ...prev,
                        principalBalance: res.data.currentPrincipalBalance !== undefined ? res.data.currentPrincipalBalance : prev.principalBalance,
                        interestBalance: res.data.currentInterestBalance !== undefined ? res.data.currentInterestBalance : prev.interestBalance,
                        overdueInterestBalance: res.data.currentOverdueInterestBalance !== undefined ? res.data.currentOverdueInterestBalance : prev.overdueInterestBalance,
                        sanctionedAmount: res.data.sanctionedAmount !== undefined ? res.data.sanctionedAmount : prev.sanctionedAmount,
                        loanDisbursementDate: res.data.disbursementDate || prev.loanDisbursementDate,
                        lastInstallmentPaidDate: res.data.lastInstallmentPaidDate !== undefined ? res.data.lastInstallmentPaidDate : prev.lastInstallmentPaidDate,
                        lastInterestPostingDate: res.data.lastInterestPostingDate !== undefined ? res.data.lastInterestPostingDate : prev.lastInterestPostingDate
                    };
                });
            }

            try {
                const npaRes = await axios.get(`/api/Npa/status/${accId}`);
                if (npaRes.data) {
                    setNpaStatus(npaRes.data);
                }
            } catch (err: any) {
                if (err.response?.status !== 404) {
                    console.error("Failed to fetch NPA status", err);
                }
            }
        } catch (err) {
            console.error("Failed to fetch schedule", err);
            setAccountDetails(null);
        }
    };

    const handleSchemeChange = (schemeId: number | null) => {
        setSelectedSchemeId(schemeId);

        if (!schemeId) {
            setSelectedBorrowerKey(null);
            setSelectedCustomerId(null);
            setSelectedAccount(null);
            setAccountDetails(null);
            setNpaStatus(null);
            (window as any).selectedLoanCustomerId = undefined;
            (window as any).selectedLoanAccountId = undefined;
            (window as any).selectedLoanMemberId = undefined;
            setFormData(p => ({ ...p, loanAccountID: undefined }));
            return;
        }

        // If a borrower is already selected, verify if they have any loans in this new scheme
        if (selectedBorrowerKey || selectedCustomerId) {
            const matchingBorrowerLoans = accounts.filter((a: any) => {
                const custId = Number(a.customerID || a.customer?.customerID || a.memberID || 0);
                const belongsToBorrower = (selectedCustomerId && custId === Number(selectedCustomerId)) ||
                    (selectedBorrowerKey && (
                        selectedBorrowerKey === `C_${custId}` || 
                        selectedBorrowerKey === `M_${a.memberID}` || 
                        selectedBorrowerKey === `ACC_${a.loanAccountID}`
                    ));
                if (!belongsToBorrower) return false;
                const rId = a.loanRateID || a.loanRate?.loanRateID;
                return Number(rId) === Number(schemeId);
            });

            if (matchingBorrowerLoans.length === 0) {
                // Current borrower has no loans in this scheme -> reset selection cleanly
                setSelectedBorrowerKey(null);
                setSelectedCustomerId(null);
                setSelectedAccount(null);
                setAccountDetails(null);
                setNpaStatus(null);
                (window as any).selectedLoanCustomerId = undefined;
                (window as any).selectedLoanAccountId = undefined;
                (window as any).selectedLoanMemberId = undefined;
                setFormData(p => ({ ...p, loanAccountID: undefined }));
            } else if (matchingBorrowerLoans.length === 1) {
                // Exactly 1 loan in this scheme -> auto-select it!
                selectLoanAccountById(matchingBorrowerLoans[0].loanAccountID);
            } else {
                // Multiple loans in this scheme -> keep account unset so the inline grid prompts user
                setSelectedAccount(null);
                setAccountDetails(null);
                setNpaStatus(null);
                (window as any).selectedLoanAccountId = undefined;
                setFormData(p => ({ ...p, loanAccountID: undefined }));
            }
        }
    };

    const handleCustomerSelect = (customerId: number | '') => {
        const cId = customerId ? Number(customerId) : null;
        setSelectedCustomerId(cId);
        (window as any).selectedLoanCustomerId = cId || undefined;

        if (!cId) {
            setSelectedBorrowerKey(null);
            setSelectedAccount(null);
            setAccountDetails(null);
            setNpaStatus(null);
            (window as any).selectedLoanAccountId = undefined;
            (window as any).selectedLoanMemberId = undefined;
            setFormData(p => ({ ...p, loanAccountID: undefined }));
            return;
        }

        setSelectedBorrowerKey(`C_${cId}`);

        // Loans of this customer matching the chosen scheme
        const loans = accounts.filter((a: any) => {
            const custId = Number(a.customerID || a.customer?.customerID || a.memberID || 0);
            if (custId !== cId) return false;
            if (selectedSchemeId) {
                const rId = a.loanRateID || a.loanRate?.loanRateID;
                return Number(rId) === Number(selectedSchemeId);
            }
            return true;
        });

        if (loans.length === 1) {
            selectLoanAccountById(loans[0].loanAccountID);
        } else {
            // Multiple loans: keep single account unset so the inline grid is shown
            setSelectedAccount(null);
            setAccountDetails(null);
            setNpaStatus(null);
            (window as any).selectedLoanAccountId = undefined;
            setFormData(p => ({ ...p, loanAccountID: undefined }));
        }
    };

    const handleMemberChange = (e: any) => {
        const val = e?.target?.value || e;
        if (!val) {
            handleCustomerSelect('');
            return;
        }
        if (typeof val === 'number') {
            handleCustomerSelect(val);
        } else {
            const numericId = parseInt(String(val).replace(/\D/g, ''), 10);
            handleCustomerSelect(numericId || '');
        }
    };

    const handleLoanAccountSelect = (e: any) => {
        const val = e.target.value;
        if (!val) {
            setSelectedAccount(null);
            setAccountDetails(null);
            setNpaStatus(null);
            setFormData(p => ({ ...p, loanAccountID: undefined }));
            return;
        }
        selectLoanAccountById(parseInt(val));
    };

    const getInterestStartDate = (acc: any): string | null => {
        if (!acc) return null;

        const candidates: Array<{ date: Date; dateStr: string }> = [];

        const addCandidate = (dStr: string | undefined | null) => {
            if (!dStr) return;
            const d = parseDateSafe(dStr);
            if (!isNaN(d.getTime())) {
                candidates.push({ date: d, dateStr: dStr });
            }
        };

        addCandidate(acc.lastInterestPostingDate);
        addCandidate(acc.lastInstallmentPaidDate);

        let latest: { date: Date; dateStr: string } | null = null;
        for (const c of candidates) {
            if (!latest || c.date.getTime() > latest.date.getTime()) {
                latest = c;
            }
        }

        // Core Banking Rule: For opening balance loans, interest begins from openingDate (migration cutoff date e.g. 31/03/2026), NOT historical disbursementDate (e.g. 31/03/2025)
        if (acc.isOpeningBalance && acc.openingDate) {
            const opDate = parseDateSafe(acc.openingDate);
            if (!isNaN(opDate.getTime())) {
                if (!latest || latest.date.getTime() < opDate.getTime()) {
                    return acc.openingDate;
                }
            }
        }

        if (latest) {
            return latest.dateStr;
        }

        return acc.loanDisbursementDate || acc.openingDate || null;
    };

    // Core banking day count: Excludes repayment date unless configured otherwise (e.g. 31/03/2026 to 07/10/2026 = 189 days)
    const calculateElapsedDays = (fromDateStr: string | Date | null | undefined, toDateVal: string | Date | null | undefined): number => {
        if (!fromDateStr) return 0;
        const fromDate = parseDateSafe(fromDateStr);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = parseDateSafe(toDateVal || new Date());
        toDate.setHours(0, 0, 0, 0);

        const rawDiffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        if (rawDiffDays <= 0) return 0;

        const isIncludePaymentDay = sanstha?.loanInterestDayCountMethod === 'IncludePaymentDay';
        return isIncludePaymentDay ? rawDiffDays : Math.max(0, rawDiffDays - 1);
    };

    const calculateInterest = (acc: any, dateStr: string) => {
        if (!acc) return;
        const loanRate = acc.loanRate;
        const isInterestOnly = loanRate && 
            (loanRate.loanInstallmentType?.includes("व्याजवरती") || 
             loanRate.loanInstallmentType?.includes("Interest Only") ||
             loanRate.loanInstallmentType?.includes("Bullet") ||
             loanRate.shortName?.toLowerCase().includes("gold") ||
             loanRate.loanType?.includes("सोने"));

        const rate = acc.loanRate?.interestRate || acc.interestRate || 0;
        const principal = acc.principalBalance || 0;
        const fromDateStr = getInterestStartDate(acc);
        let daysInterest = 0;
        if (fromDateStr) {
            const diffDays = calculateElapsedDays(fromDateStr, dateStr || new Date());
            if (diffDays > 0) {
                daysInterest = Math.round((principal * rate * diffDays) / 36500);
            }
        }
        const yeneVyaj = accountDetails?.currentInterestBalance !== undefined ? accountDetails.currentInterestBalance : (acc.interestBalance || 0);
        const penal = acc.overdueInterestBalance || 0;

        if (isInterestOnly) {
            const totalDue = penal + yeneVyaj + daysInterest;
            autoApportion(totalDue, formData.fees || [], acc, dateStr);
        } else {
            const installment = acc.installmentAmount || 0;
            // 1 regular principal installment + old receivable interest + current days interest + penalty
            const totalDue = installment + yeneVyaj + daysInterest + penal;
            autoApportion(totalDue, formData.fees || [], acc, dateStr);
        }
    };

    // Watch for collectionDate and accountDetails changes to recalculate interest and due amount
    useEffect(() => {
        if (isPassingMode) return;
        if (selectedAccount) {
            const loanRate = selectedAccount.loanRate;
            const isDailyReducing = loanRate && 
                (loanRate.interestCalculationMethod?.includes("Daily Reducing") || loanRate.interestCalculationMethod?.includes("दैनिक घटती"));

            const isInterestOnly = loanRate && 
                (loanRate.loanInstallmentType?.includes("व्याजवरती") || 
                 loanRate.loanInstallmentType?.includes("Interest Only") ||
                 loanRate.loanInstallmentType?.includes("Bullet") ||
                 loanRate.shortName?.toLowerCase().includes("gold") ||
                 loanRate.loanType?.includes("सोने"));

            if (isInterestOnly) {
                calculateInterest(selectedAccount, formData.collectionDate || new Date().toISOString().split('T')[0]);
            } else if (!isDailyReducing && accountDetails?.schedule && accountDetails.schedule.length > 0) {
                const collectionDateObj = parseDateSafe(formData.collectionDate || new Date());
                collectionDateObj.setHours(0, 0, 0, 0);

                const overdueInstallments = accountDetails.schedule.filter(s => {
                    const dueDateObj = parseDateSafe(s.dueDate);
                    dueDateObj.setHours(0, 0, 0, 0);

                    // For opening balance loans, ignore schedule items on/before opening date
                    if (selectedAccount.isOpeningBalance && selectedAccount.openingDate) {
                        const openingDateObj = parseDateSafe(selectedAccount.openingDate);
                        openingDateObj.setHours(0, 0, 0, 0);
                        if (dueDateObj <= openingDateObj) return false;
                    }

                    return dueDateObj <= collectionDateObj && s.status !== 'Paid';
                });

                let totalInstDue = 0;
                if (overdueInstallments.length > 0) {
                    const overduePrincipal = overdueInstallments.reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
                    const overdueInterest = overdueInstallments.reduce((sum, s) => sum + s.interestAmount, 0);
                    totalInstDue = overduePrincipal + overdueInterest;
                } else {
                    const nextInstallment = accountDetails.schedule.find(s => s.status !== 'Paid');
                    if (nextInstallment) {
                        const nextP = nextInstallment.remainingPrincipal !== undefined ? nextInstallment.remainingPrincipal : nextInstallment.principalAmount;
                        totalInstDue = nextP + (nextInstallment.interestAmount || 0);
                    }
                }
                const yeneVyaj = accountDetails?.currentInterestBalance !== undefined ? accountDetails.currentInterestBalance : (selectedAccount.interestBalance || 0);
                autoApportion((totalInstDue > 0 ? totalInstDue : (selectedAccount.installmentAmount || 0)) + yeneVyaj, formData.fees || [], selectedAccount);
            } else {
                calculateInterest(selectedAccount, formData.collectionDate || new Date().toISOString().split('T')[0]);
            }
        }
    }, [formData.collectionDate, accountDetails, selectedAccount]);

    const applyQuickAmount = (type: '1_INST' | 'INTEREST_ONLY' | 'FULL_DUE') => {
        const account = selectedAccount;
        if (!account) return;
        const dateStr = formData.collectionDate || new Date().toISOString().split('T')[0];
        const feesSum = (formData.fees || []).reduce((acc, f) => acc + (f.amount || 0), 0);
        const penal = account.overdueInterestBalance || 0;
        const yeneVyaj = accountDetails?.currentInterestBalance !== undefined ? accountDetails.currentInterestBalance : (account.interestBalance || 0);

        const loanRate = account.loanRate;
        const isDailyReducing = loanRate && 
            (loanRate.interestCalculationMethod?.includes("Daily Reducing") || loanRate.interestCalculationMethod?.includes("दैनिक घटती"));

        let currentInterestDue = 0;
        let principalDue = 0;

        if (!isDailyReducing && accountDetails?.schedule && accountDetails.schedule.length > 0) {
            const collectionDateObj = parseDateSafe(dateStr);
            collectionDateObj.setHours(0, 0, 0, 0);

            const overdueInstallments = accountDetails.schedule.filter(s => {
                const dueDateObj = parseDateSafe(s.dueDate);
                dueDateObj.setHours(0, 0, 0, 0);
                if (account.isOpeningBalance && account.openingDate) {
                    const openingDateObj = parseDateSafe(account.openingDate);
                    openingDateObj.setHours(0, 0, 0, 0);
                    if (dueDateObj <= openingDateObj) return false;
                }
                return dueDateObj <= collectionDateObj && s.status !== 'Paid';
            });

            let targetInstallments: any[] = [];
            if (overdueInstallments.length > 0) {
                targetInstallments = overdueInstallments;
            } else {
                const nextInstallment = accountDetails.schedule.find(s => s.status !== 'Paid');
                if (nextInstallment) targetInstallments = [nextInstallment];
            }

            if (targetInstallments.length > 0) {
                currentInterestDue = targetInstallments.reduce((sum, s) => sum + s.interestAmount, 0);
                principalDue = targetInstallments.reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
            }
        } else {
            const rate = account.loanRate?.interestRate || account.interestRate || 0;
            const principal = account.principalBalance || 0;
            const fromDateStr = getInterestStartDate(account);
            if (fromDateStr) {
                const diffDays = calculateElapsedDays(fromDateStr, dateStr);
                if (diffDays > 0) {
                    currentInterestDue = Math.round((principal * rate * diffDays) / 36500);
                }
            }
            principalDue = account.installmentAmount || 0;
        }

        if (type === 'INTEREST_ONLY') {
            const total = penal + yeneVyaj + currentInterestDue + feesSum;
            autoApportion(total, formData.fees || []);
        } else if (type === '1_INST') {
            const total = principalDue + penal + yeneVyaj + currentInterestDue + feesSum;
            autoApportion(total, formData.fees || []);
        } else if (type === 'FULL_DUE') {
            const maxPrincipal = account.principalBalance || 0;
            const total = maxPrincipal + penal + yeneVyaj + currentInterestDue + feesSum;
            autoApportion(total, formData.fees || []);
        }
    };

    const handleTotalAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value) || 0;
        autoApportion(val, formData.fees || []);
    };

    const autoApportion = (totalAmt: number, currentFees: any[], accountOverride?: any, dateOverride?: string) => {
        const account = accountOverride || selectedAccount;
        if (!account) return;
        
        const dateStr = dateOverride || formData.collectionDate || new Date().toISOString().split('T')[0];
        let remaining = totalAmt;
        
        // 1. Subtract Fees first
        const feesSum = currentFees.reduce((acc, f) => acc + (f.amount || 0), 0);
        remaining = Math.max(0, remaining - feesSum);

        // 2. Penalty Interest (Overdue)
        const penaltyDue = account.overdueInterestBalance || 0;
        const penaltyCollected = Math.min(remaining, penaltyDue);
        remaining -= penaltyCollected;

        const loanRate = account.loanRate;
        const isDailyReducing = loanRate && 
            (loanRate.interestCalculationMethod?.includes("Daily Reducing") || loanRate.interestCalculationMethod?.includes("दैनिक घटती"));

        // 3. Past Posted / Accrued Receivable Interest (येणे व्याज)
        const receivableDue = accountDetails?.currentInterestBalance !== undefined ? accountDetails.currentInterestBalance : (account.interestBalance || 0);
        const receivableCollected = Math.min(remaining, receivableDue);
        remaining -= receivableCollected;

        let currentInterestDue = 0;
        let principalDue = 0;

        // Check if we have schedule details loaded and is NOT daily reducing
        if (!isDailyReducing && accountDetails?.schedule && accountDetails.schedule.length > 0) {
            const collectionDateObj = parseDateSafe(dateStr);
            collectionDateObj.setHours(0, 0, 0, 0);

            const overdueInstallments = accountDetails.schedule.filter(s => {
                const dueDateObj = parseDateSafe(s.dueDate);
                dueDateObj.setHours(0, 0, 0, 0);

                if (account.isOpeningBalance && account.openingDate) {
                    const openingDateObj = parseDateSafe(account.openingDate);
                    openingDateObj.setHours(0, 0, 0, 0);
                    if (dueDateObj <= openingDateObj) return false;
                }

                return dueDateObj <= collectionDateObj && s.status !== 'Paid';
            });

            let targetInstallments: any[] = [];
            if (overdueInstallments.length > 0) {
                targetInstallments = overdueInstallments;
            } else {
                const nextInstallment = accountDetails.schedule.find(s => s.status !== 'Paid');
                if (nextInstallment) targetInstallments = [nextInstallment];
            }

            if (targetInstallments.length > 0) {
                currentInterestDue = targetInstallments.reduce((sum, s) => sum + s.interestAmount, 0);
                principalDue = targetInstallments.reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
            }
        } else {
            // Dynamic daily calculation for daily reducing
            const rate = account.loanRate?.interestRate || account.interestRate || 0;
            const principal = account.principalBalance || 0;
            const fromDateStr = getInterestStartDate(account);
            if (fromDateStr) {
                const diffDays = calculateElapsedDays(fromDateStr, dateStr);
                if (diffDays > 0) {
                    currentInterestDue = Math.round((principal * rate * diffDays) / 36500);
                }
            }
            principalDue = account.installmentAmount || 0;
        }

        // 4. Current Period Interest (चालू व्याज)
        const currentInterestCollected = Math.min(remaining, currentInterestDue);
        remaining -= currentInterestCollected;

        // 5. Principal
        const maxPrincipal = account.principalBalance || 0;
        const targetPrincipal = principalDue > 0 ? principalDue : maxPrincipal;
        const basePrincipalCollected = Math.min(remaining, targetPrincipal);
        remaining -= basePrincipalCollected;

        // 6. Remaining to Extra Principal / Surcharge
        const actualPrincipalCol = Math.min(maxPrincipal, basePrincipalCollected + remaining);
        const surchargeCol = (basePrincipalCollected + remaining) > maxPrincipal ? ((basePrincipalCollected + remaining) - maxPrincipal) : 0;

        setFormData(p => ({
            ...p,
            totalAmountReceived: totalAmt,
            penaltyInterestCollected: penaltyCollected,
            receivableInterestCollected: receivableCollected,
            interestCollected: currentInterestCollected,
            principalCollected: actualPrincipalCol,
            surchargeCollected: surchargeCol,
            fees: currentFees
        }));
    };

    const handleSplitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const val = parseFloat(value) || 0;
        
        setFormData(p => {
            const newForm = { ...p, [name]: val };
            const feesSum = (newForm.fees || []).reduce((acc, f) => acc + (f.amount || 0), 0);
            
            if (name === 'interestCollected' || name === 'receivableInterestCollected' || name === 'penaltyInterestCollected' || name === 'surchargeCollected') {
                // Keep total constant, adjust principal
                let newPrincipal = (p.totalAmountReceived || 0) - feesSum - (newForm.receivableInterestCollected || 0) - (newForm.interestCollected || 0) - (newForm.penaltyInterestCollected || 0) - (newForm.surchargeCollected || 0);
                
                if (newPrincipal < 0) {
                    newPrincipal = 0;
                    // If principal goes below 0, adjust total instead
                    newForm.totalAmountReceived = feesSum + (newForm.receivableInterestCollected || 0) + (newForm.interestCollected || 0) + (newForm.penaltyInterestCollected || 0) + (newForm.surchargeCollected || 0);
                }
                newForm.principalCollected = newPrincipal;
            } else if (name === 'principalCollected') {
                // If explicitly changing principal, recalculate total
                newForm.totalAmountReceived = (newForm.principalCollected || 0) + (newForm.receivableInterestCollected || 0) + (newForm.interestCollected || 0) + (newForm.penaltyInterestCollected || 0) + (newForm.surchargeCollected || 0) + feesSum;
            }
            
            return newForm;
        });
    };

    const handleFeeChange = (index: number, field: string, val: any) => {
        const newFees = [...(formData.fees || [])];
        newFees[index] = { ...newFees[index], [field]: field === 'amount' ? (parseFloat(val) || 0) : parseInt(val) };
        autoApportion(formData.totalAmountReceived || 0, newFees);
    };

    const addFeeRow = () => {
        setFormData(p => ({
            ...p,
            fees: [...(p.fees || []), { ledgerID: 0, amount: 0 }]
        }));
    };

    const removeFeeRow = (index: number) => {
        const newFees = formData.fees?.filter((_, i) => i !== index) || [];
        autoApportion(formData.totalAmountReceived || 0, newFees);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isPassingMode) {
            return;
        }
        
        if ((formData.isOTS || (formData.interestWaived || 0) > 0 || (formData.penaltyWaived || 0) > 0) && !formData.resolutionNo?.trim()) {
            alert('एकरकम तडजोड (OTS) किंवा व्याज सूटीसाठी संचालक मंडळाचा ठराव क्रमांक (Resolution No.) प्रविष्ट करणे अनिवार्य आहे.');
            return;
        }

        if (!formData.isOTS && selectedAccount && formData.principalCollected && selectedAccount.principalBalance !== undefined) {
            if (formData.principalCollected > selectedAccount.principalBalance + 0.01) {
                alert(`जमा मुद्दल रक्कम (₹${formData.principalCollected.toLocaleString('en-IN')}) ही शिल्लक मुद्दल रक्कमेपेक्षा (₹${selectedAccount.principalBalance.toLocaleString('en-IN')}) जास्त असू शकत नाही.`);
                return;
            }
        }

        try {
            const payload = {
                ...formData,
                branchID: selectedBranchId
            };
            const res = await axios.post('/api/LoanCollections', payload);
            const savedCollectionId = res.data?.loanCollectionID || res.data?.LoanCollectionID;

            // Save the ID for printing
            if (savedCollectionId) {
                setLastSavedCollectionId(savedCollectionId);
            }

            // Check if loan was fully settled and has active collaterals
            if (res.data?.isLoanFullySettled && res.data?.activeCollaterals && res.data.activeCollaterals.length > 0) {
                setLienPromptData({
                    loanAccountId: res.data.loanAccountID || res.data.LoanAccountID || selectedAccount?.loanAccountID,
                    loanAccountNo: res.data.settledLoanAccountNo || selectedAccount?.loanAccountNo || '',
                    activeCollaterals: res.data.activeCollaterals,
                    collectionId: savedCollectionId
                });
            } else {
                alert('पावती यशस्वीरित्या जतन झाली!');
            }

            // Reset form
            setFormData({
                collectionDate: activeBusinessDate,
                receiptNo: '',
                paymentMode: "Cash",
                totalAmountReceived: 0,
                surchargeCollected: 0,
                penaltyInterestCollected: 0,
                receivableInterestCollected: 0,
                interestCollected: 0,
                principalCollected: 0,
                fees: []
            });
            setSelectedBorrowerKey(null);
            setSelectedCustomerId(null);
            setSelectedAccount(null);
            setAccountDetails(null);
            (window as any).selectedLoanCustomerId = undefined;
            (window as any).selectedLoanAccountId = undefined;
            (window as any).selectedLoanMemberId = undefined;
            fetchData();
            fetchAccounts();
            fetchNextReceiptNo(selectedBranchId);
        } catch (err: any) {
            alert('माहिती जतन करण्यास अडचण आली: ' + (err.response?.data || err.message));
            console.error(err);
        }
    };

    const handleDirectWhatsAppShare = (c: any) => {
        if (!c) return;
        const sansthaName = sanstha?.sansthaName || 'स्मार्ट मल्टीस्टेट पतसंस्था लि.';
        const borrower = c.loanAccount?.customer;
        const memberName = borrower ? `${borrower.firstName || ''} ${borrower.lastName || ''}`.trim() : 'खातेदार';
        const mobileNo = borrower?.mobileNo || '';

        const totalFees = c.fees?.reduce((acc: number, f: any) => acc + (f.amount || 0), 0) || 0;
        const totalAmount = (c.totalAmountReceived || 0) + totalFees;

        const message = 
`🏦 *${sansthaName}*
----------------------------------------
🧾 *कर्ज जमा पावती (Loan Receipt)*

नमस्कार *${memberName}*,
तुमची कर्ज वसुली जमा पावती यशस्वीरित्या नोंदवली गेली आहे:

📄 *पावती क्रमांक:* ${c.receiptNo}
🗓️ *जमा दिनांक:* ${new Date(c.collectionDate).toLocaleDateString('en-GB')}
👤 *कर्ज खाते क्र.:* ${c.loanAccount?.loanAccountNo}
📊 *कर्ज प्रकार:* ${c.loanAccount?.loanRate?.shortName || c.loanAccount?.loanRate?.loanType || '-'}

💵 *जमा रक्कम तपशील:*
• मुद्दल जमा: ₹ ${c.principalCollected?.toLocaleString('en-IN') || '0.00'}
${(c.receivableInterestCollected || 0) > 0 ? `• थकीत येणे व्याज: ₹ ${(c.receivableInterestCollected || 0).toLocaleString('en-IN')}\n` : ''}• चालू व्याज जमा: ₹ ${c.interestCollected?.toLocaleString('en-IN') || '0.00'}
${c.penaltyInterestCollected > 0 ? `• जादा व्याज: ₹ ${c.penaltyInterestCollected?.toLocaleString('en-IN')}\n` : ''}${c.surchargeCollected > 0 ? `• सरचार्ज: ₹ ${c.surchargeCollected?.toLocaleString('en-IN')}\n` : ''}💰 *एकूण जमा रक्कम:* ₹ ${totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
💳 *पेमेंट पद्धत:* ${c.paymentMode}

सदर पावती संगणक प्रणालीद्वारे तयार करण्यात आली आहे.
धन्यवाद! 🙏
*${sansthaName}*`;

        const encodedMsg = encodeURIComponent(message);
        const cleanMobile = mobileNo ? mobileNo.replace(/\D/g, '') : '';
        const phoneParam = cleanMobile ? (cleanMobile.length === 10 ? `phone=91${cleanMobile}&` : `phone=${cleanMobile}&`) : '';
        if (!navigator.onLine) {
            alert('इंटरनेट कनेक्शन उपलब्ध नाही (Offline Mode). कृपया पावती प्रिंट करा.');
            return;
        }

        const waUrl = `https://api.whatsapp.com/send?${phoneParam}text=${encodedMsg}`;
        window.open(waUrl, '_blank');
    };

    const getCollateralTypeName = (type: string) => {
        switch (type) {
            case 'FixedDeposit': return 'मुदत ठेव (FD)';
            case 'PigmyDeposit': return 'पिग्मी ठेव (Pigmy)';
            case 'RecurringDeposit': return 'आवर्ती ठेव (RD)';
            case 'SavingDeposit': return 'बचत खाते (Saving)';
            default: return type;
        }
    };

    const handleReleaseAllLiens = async () => {
        if (!lienPromptData) return;
        setReleasingLien(true);
        try {
            const res = await axios.post(`/api/LoanCollaterals/ReleaseAllByLoan/${lienPromptData.loanAccountId}`);
            alert(res.data?.message || 'तारण ठेवींवरील बोजा यशस्वीरित्या काढण्यात आला!');
            setLienPromptData(null);
        } catch (err: any) {
            alert('बोजा मोकळा करण्यास अडचण आली: ' + (err.response?.data?.message || err.response?.data || err.message));
            console.error(err);
        } finally {
            setReleasingLien(false);
        }
    };

    const handlePrintClick = () => {
        if (lastSavedCollectionId) {
            setPrintingCollectionId(lastSavedCollectionId);
        } else {
            alert('कृपया आधी माहिती जतन (Save) करा. (Please save the entry first)');
        }
    };

    if (printingCollectionId) {
        return <LoanCollectionReceiptPrint collectionId={printingCollectionId} onBack={() => setPrintingCollectionId(null)} />;
    }

    const inputClass = "w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] h-[24px]";
    const labelClass = "block text-[11px] font-semibold text-gray-700 mb-0.5";

    return (
        <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4">
            {/* Page Header */}
            <div className="bg-primary text-white px-3 py-1.5 rounded-t-sm flex justify-between items-center shadow-xs mb-2">
                <h1 className="text-sm font-bold flex items-center gap-2">
                    <FileText size={16} /> कर्ज वसुली (Loan Collection)
                </h1>
                <div className="flex items-center gap-2 text-xs">
                    <span className="bg-white/20 text-white px-2 py-0.5 rounded-sm font-mono text-[11px] font-bold">
                        Smart Banking ERP
                    </span>
                </div>
            </div>

            {/* ⚠️ Passing Mode Verification Alert Banner */}
            {isPassingMode && (
                <div className="mb-2 p-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-sm shadow-md border border-amber-600 flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <div className="font-black text-xs tracking-wide uppercase flex items-center gap-1.5">
                                <span>व्हाउचर तपासणी व मंजुरी मोड (Voucher Passing & Verification Mode)</span>
                                <span className="bg-amber-900/50 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                                    फक्त वाचन (Read-Only)
                                </span>
                            </div>
                            <div className="text-[11px] text-amber-100 flex flex-wrap items-center gap-3 mt-0.5">
                                <span>पावती / व्हाउचर क्र: <strong className="font-mono text-white">{passingVoucher?.voucherNo || formData.receiptNo || '-'}</strong></span>
                                {passingVoucher?.scrollNo && <span>स्क्रोल क्र: <strong className="font-mono text-white">{passingVoucher.scrollNo}</strong></span>}
                                {passingVoucher?.createdByUser?.username && (
                                    <span>नोंद करणारा (Maker): <strong className="text-white">{passingVoucher.createdByUser.username}</strong></span>
                                )}
                                <span>जमा रक्कम: <strong className="font-mono text-white">₹{(formData.totalAmountReceived || 0).toFixed(2)}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onNavigate ? onNavigate('voucher-posting') : window.location.href = '/?tab=voucher-posting'}
                            className="bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            <span>↩️ मागे जा</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setRejectModalOpen(true)}
                            disabled={passingActionLoading}
                            className="bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                            <Trash2 size={13} />
                            <span>रिजेक्ट करा</span>
                        </button>
                        <button
                            type="button"
                            onClick={handlePassVoucher}
                            disabled={passingActionLoading}
                            className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black px-3 py-1 rounded shadow-sm transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                            <CheckCircle size={14} />
                            <span>{passingActionLoading ? 'पास होत आहे...' : '✅ पास करा (Approve)'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* No Loan Found Alert */}
            {noLoanFoundAlert && (
                <div className="mb-2 p-2.5 bg-amber-50 text-amber-900 rounded-sm border border-amber-300 flex items-center justify-between text-xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{noLoanFoundAlert}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setNoLoanFoundAlert(null)}
                        className="text-amber-800 hover:text-black font-bold text-xs px-2 py-0.5 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit}>
            <div className="flex flex-col lg:flex-row gap-2.5">
                {/* Left Sidebar - Payment Details */}
                <div className="w-full lg:w-1/4 bg-white rounded-sm shadow-xs border border-gray-300 flex flex-col overflow-hidden">
                    <div className="bg-primary text-white px-2.5 py-1 text-xs font-bold flex items-center justify-between shadow-xs border-b border-primary/20">
                        <span className="flex items-center gap-1.5"><CheckSquare size={13} /> पावती तपशील (Receipt Details)</span>
                    </div>

                    <div className="p-2 flex flex-col gap-2">
                        {/* Collecting Branch Selector */}
                        <div className="bg-primary/5 p-1.5 rounded-sm border border-primary/20 flex flex-col gap-1 text-[11px]">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-gray-700 flex items-center gap-1">
                                    <Building2 className="w-3.5 h-3.5 text-primary" /> वसुल शाखा (Collecting Branch):
                                </span>
                                {!isHOUser && (
                                    <span className="text-[10px] text-gray-500 font-semibold bg-gray-200 px-1 rounded">(शाखा लॉक)</span>
                                )}
                            </div>
                            <select
                                value={selectedBranchId}
                                onChange={(e) => {
                                    const bId = parseInt(e.target.value, 10);
                                    setSelectedBranchId(bId);
                                    fetchData(bId);
                                    fetchNextReceiptNo(bId, selectedAccount?.loanAccountID);
                                }}
                                disabled={isPassingMode || !isHOUser}
                                className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs font-bold bg-white text-gray-800 disabled:bg-slate-100 disabled:text-gray-600 focus:outline-none focus:border-primary cursor-pointer"
                            >
                                {branches.map(b => (
                                    <option key={b.branchID} value={b.branchID}>
                                        {b.branchName} ({b.branchCode})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-primary/5 p-1.5 rounded-sm border border-primary/20 flex justify-between items-center text-[11px]">
                            <span className="font-bold text-gray-700">पावती क्र. (Receipt No):</span>
                            <span className="font-mono font-bold text-primary text-xs bg-white px-2 py-0.5 rounded-sm border border-primary/30 shadow-2xs">
                                {formData.receiptNo || 'Auto'}
                            </span>
                        </div>
                        
                        <div className="space-y-1.5 text-[11px]">
                            {/* Quick Selection Buttons */}
                            {selectedAccount && !isPassingMode && (
                                <div className="grid grid-cols-3 gap-1 mb-1.5">
                                    <button
                                        type="button"
                                        onClick={() => applyQuickAmount('1_INST')}
                                        className="px-1 py-1 text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-sm transition-colors text-center cursor-pointer shadow-2xs"
                                        title="१ हप्ता मुद्दल + सर्व व्याज व फी"
                                    >
                                        ⚡ १ हप्ता
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyQuickAmount('INTEREST_ONLY')}
                                        className="px-1 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-sm transition-colors text-center cursor-pointer shadow-2xs"
                                        title="थकीत येणे व्याज + चालू व्याज + दंड"
                                    >
                                        ⚡ फक्त व्याज
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyQuickAmount('FULL_DUE')}
                                        className="px-1 py-1 text-[10px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-sm transition-colors text-center cursor-pointer shadow-2xs"
                                        title="संपूर्ण थकबाकी (मुद्दल + सर्व व्याज + दंड)"
                                    >
                                        ⚡ पूर्ण नील
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-between items-center bg-primary/10 p-1.5 rounded-sm border border-primary/30 mb-2">
                                <label className="font-bold text-primary">एकूण जमा रक्कम (Total)</label>
                                <input type="number" name="totalAmountReceived" value={formData.totalAmountReceived || ''} onChange={handleTotalAmountChange} min="0" disabled={isPassingMode}
                                    className={`w-28 border-2 border-primary px-2 py-1 font-bold focus:outline-none focus:ring-1 focus:ring-primary rounded-sm text-right ${isPassingMode ? 'bg-slate-100 text-gray-700 cursor-not-allowed' : 'bg-white text-primary'}`} placeholder="₹0.00" />
                            </div>

                            <div className="flex justify-between items-center hover:bg-gray-50 p-1 rounded-sm transition-colors">
                                <label className="font-semibold text-gray-700">रक्कम (Principal)</label>
                                <input type="number" name="principalCollected" value={formData.principalCollected !== undefined ? formData.principalCollected : ''} onChange={handleSplitChange} min="0" disabled={isPassingMode}
                                    className={`w-24 border border-gray-300 rounded-sm px-1.5 py-0.5 h-[22px] focus:outline-none focus:border-primary text-right font-medium ${isPassingMode ? 'bg-slate-100 text-gray-700 cursor-not-allowed' : 'bg-white text-gray-800'}`} />
                            </div>

                            <div className="flex justify-between items-center bg-emerald-50/50 p-1 rounded-sm border border-emerald-200/60 transition-colors">
                                <div className="flex flex-col">
                                    <label className="font-bold text-emerald-800">येणे व्याज (Past Int)</label>
                                    {selectedAccount && (
                                        <span className="text-[9px] text-emerald-600 font-semibold font-mono">
                                            बाकी: ₹{(accountDetails?.currentInterestBalance !== undefined ? accountDetails.currentInterestBalance : (selectedAccount.interestBalance || 0)).toLocaleString('en-IN')}
                                        </span>
                                    )}
                                </div>
                                <input type="number" name="receivableInterestCollected" value={formData.receivableInterestCollected !== undefined ? formData.receivableInterestCollected : ''} onChange={handleSplitChange} min="0" disabled={isPassingMode}
                                    className={`w-24 border border-emerald-300 rounded-sm px-1.5 py-0.5 h-[22px] focus:outline-none focus:border-emerald-600 text-right font-bold text-emerald-900 ${isPassingMode ? 'bg-slate-100 text-gray-700 cursor-not-allowed' : 'bg-emerald-50/60'}`} />
                            </div>

                            <div className="flex justify-between items-center hover:bg-gray-50 p-1 rounded-sm transition-colors">
                                <label className="font-semibold text-gray-700">चालू व्याज (Current Int)</label>
                                <input type="number" name="interestCollected" value={formData.interestCollected !== undefined ? formData.interestCollected : ''} onChange={handleSplitChange} min="0" disabled={isPassingMode}
                                    className={`w-24 border border-gray-300 rounded-sm px-1.5 py-0.5 h-[22px] focus:outline-none focus:border-primary text-right font-medium ${isPassingMode ? 'bg-slate-100 text-gray-700 cursor-not-allowed' : 'bg-white text-gray-800'}`} />
                            </div>

                            <div className="flex justify-between items-center hover:bg-gray-50 p-1 rounded-sm transition-colors">
                                <div className="flex flex-col">
                                    <label className="font-semibold text-gray-700">जादा व्याज (Penal Int)</label>
                                    {selectedAccount && (selectedAccount.overdueInterestBalance || 0) > 0 && (
                                        <span className="text-[9px] text-rose-600 font-semibold font-mono">
                                            बाकी: ₹{(selectedAccount.overdueInterestBalance || 0).toLocaleString('en-IN')}
                                        </span>
                                    )}
                                </div>
                                <input type="number" name="penaltyInterestCollected" value={formData.penaltyInterestCollected !== undefined ? formData.penaltyInterestCollected : ''} onChange={handleSplitChange} min="0" disabled={isPassingMode}
                                    className={`w-24 border border-gray-300 rounded-sm px-1.5 py-0.5 h-[22px] focus:outline-none focus:border-primary text-right font-medium ${isPassingMode ? 'bg-slate-100 text-gray-700 cursor-not-allowed' : 'bg-white text-gray-800'}`} />
                            </div>

                            <div className="flex justify-between items-center hover:bg-gray-50 p-1 rounded-sm transition-colors">
                                <label className="font-semibold text-gray-700">देणे सरचार्ज (Surcharge)</label>
                                <input type="number" name="surchargeCollected" value={formData.surchargeCollected !== undefined ? formData.surchargeCollected : ''} onChange={handleSplitChange} min="0" disabled={isPassingMode}
                                    className={`w-24 border border-gray-300 rounded-sm px-1.5 py-0.5 h-[22px] focus:outline-none focus:border-primary text-right font-medium ${isPassingMode ? 'bg-slate-100 text-gray-700 cursor-not-allowed' : 'bg-white text-gray-800'}`} />
                            </div>
     
                            {/* Dynamic Ledgers */}
                            <div className="pt-2 border-t border-gray-200 mt-2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-primary text-[11px]">इतर वसूल खाते</span>
                                    {!isPassingMode && (
                                        <button type="button" onClick={addFeeRow} className="text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 text-[10px] font-bold transition-colors cursor-pointer">
                                            <PlusCircle size={12} /> खाते जोडा
                                        </button>
                                    )}
                                </div>
                                
                                {formData.fees?.map((fee, index) => (
                                    <div key={index} className="flex gap-1 mb-1 items-center bg-gray-50 p-1 rounded-sm border border-gray-200">
                                        <select value={fee.ledgerID} onChange={(e) => handleFeeChange(index, 'ledgerID', e.target.value)} disabled={isPassingMode}
                                            className="w-full border border-gray-300 px-1 py-0.5 focus:outline-none focus:border-primary text-[10px] rounded-sm bg-white disabled:bg-slate-100 disabled:cursor-not-allowed">
                                            <option value="0">खाते निवडा...</option>
                                            {ledgers.map(l => (
                                                <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>
                                            ))}
                                        </select>
                                        <input type="number" value={fee.amount || ''} onChange={(e) => handleFeeChange(index, 'amount', e.target.value)} min="0" placeholder="रक्कम" disabled={isPassingMode}
                                            className="w-16 border border-gray-300 px-1.5 py-0.5 focus:outline-none focus:border-primary text-[10px] rounded-sm text-right font-medium bg-white disabled:bg-slate-100 disabled:cursor-not-allowed" />
                                        {!isPassingMode && (
                                            <button type="button" onClick={() => removeFeeRow(index)} className="text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"><Trash2 size={12}/></button>
                                        )}
                                    </div>
                                ))}
                            </div>
     
                            {/* Totals */}
                            <div className="pt-2 mt-2 border-t border-primary/30 space-y-1.5">
                                <div className="flex justify-between items-center bg-emerald-50/50 border-l-4 border-emerald-600 text-gray-900 p-1.5 rounded-sm shadow-2xs text-[11px]">
                                    <label className="font-semibold text-gray-700">पावती एकूण रक्कम</label>
                                    <span className="font-extrabold text-xs text-emerald-700">₹ {formData.totalAmountReceived?.toFixed(2) || '0.00'}</span>
                                </div>
                                <div className="flex justify-between items-center bg-blue-50/50 border-l-4 border-primary text-gray-900 p-1.5 rounded-sm shadow-2xs text-[11px]">
                                    <label className="font-semibold text-gray-700">नवीन शिल्लक कर्ज</label>
                                    <span className="font-extrabold text-xs text-primary">
                                        ₹ {selectedAccount ? Math.max(0, ((accountDetails?.currentPrincipalBalance !== undefined ? accountDetails.currentPrincipalBalance : (selectedAccount.principalBalance || 0)) - (formData.principalCollected || 0))).toFixed(2) : '0.00'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Main Area */}
                <div className="w-full lg:w-3/4 flex flex-col gap-2.5">
                    
                    {/* Top Controls */}
                    <div className="bg-white rounded-sm shadow-xs border border-gray-300 overflow-visible relative z-20">
                        <div className="bg-primary text-white px-2.5 py-1 text-xs font-bold flex items-center justify-between shadow-xs border-b border-primary/20">
                            <span className="flex items-center gap-1.5"><FileText size={13} /> कर्ज खाते निवड व तपशील (Loan Account Details)</span>
                        </div>

                        <div className="p-2.5">
                            {/* Row 1: Date, 1. Loan Scheme, Payment Mode */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                                <div>
                                    <label className={labelClass}>दिनांक (Date)</label>
                                    <input type="date" name="collectionDate" value={formData.collectionDate} onChange={(e) => setFormData(p => ({ ...p, collectionDate: e.target.value }))} required disabled={isPassingMode}
                                        className={`${inputClass} ${isPassingMode ? 'bg-slate-100 cursor-not-allowed' : ''}`} />
                                </div>
                                
                                <div className="md:col-span-2">
                                    <label className={`${labelClass} text-primary font-bold !mb-0.5 flex items-center gap-1`}>
                                        <Layers size={13} className="text-primary" />
                                        १. कर्ज प्रकार / योजना (Loan Scheme)
                                    </label>
                                    <select
                                        value={selectedSchemeId ? selectedSchemeId.toString() : ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            handleSchemeChange(val ? parseInt(val) : null);
                                        }}
                                        disabled={isPassingMode}
                                        className={`${inputClass} font-semibold text-xs ${selectedSchemeId ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-white'}`}
                                    >
                                        <option value="">-- कर्ज प्रकार निवडा --</option>
                                        {availableLoanSchemes.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className={labelClass}>मोड (Payment Mode)</label>
                                    <select name="paymentMode" value={formData.paymentMode} onChange={(e) => setFormData(p => ({ ...p, paymentMode: e.target.value }))} disabled={isPassingMode}
                                        className={`${inputClass} ${isPassingMode ? 'bg-slate-100 cursor-not-allowed' : ''}`}>
                                        <option value="Cash">Cash (रोख)</option>
                                        <option value="Bank">Bank Transfer (बँक ट्रान्सफर)</option>
                                        <option value="Cheque">Cheque (चेक)</option>
                                        <option value="Saving Transfer">Saving Transfer (सेव्हिंग)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Row 2: 2. Borrower Customer (Full Width with CustomerSearchSelect, 3. Loan Account removed) */}
                            <div className="mt-2 pt-2 border-t border-gray-200">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className={`${labelClass} font-bold text-gray-800 flex items-center gap-1`}>
                                            <span>२. कर्जदार खातेदार (Borrower Customer)</span>
                                            {selectedCustomerId && (
                                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                                                    ✓ खातेदार निवडला
                                                </span>
                                            )}
                                        </label>
                                        <span className="text-[10px] px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                            {selectedSchemeId ? `${borrowerCustomers.length} कर्जदार उपलब्ध` : 'आधी कर्ज प्रकार निवडा'}
                                        </span>
                                    </div>
                                    <div className="relative z-30">
                                        <CustomerSearchSelect 
                                            customers={borrowerCustomers}
                                            value={selectedCustomerId || ''} 
                                            onChange={handleCustomerSelect} 
                                            isDisabled={isPassingMode || !selectedSchemeId}
                                            placeholder={!selectedSchemeId ? "-- आधी कर्ज प्रकार निवडा --" : "-- कर्जदार खातेदार निवडा (नाव / जुने कर्ज क्र. / CIF / मोबाईलने शोधा) --"} 
                                        />
                                    </div>
                                </div>

                                {/* Active Selected Loan Account Card with Legacy Account Number */}
                                {selectedAccount && (
                                    <div className="mt-2 p-2 bg-gradient-to-r from-blue-50/90 via-slate-50 to-indigo-50/90 border border-blue-200/90 rounded-sm shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-slate-600 font-semibold">सक्रिय कर्ज खाते:</span>
                                            <span className="font-mono font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-blue-300">
                                                {format14DigitDisplay(selectedAccount.loanAccountNo)}
                                            </span>
                                            {selectedAccount.legacyAccountNumber && (
                                                <span className="font-mono font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-purple-300 text-[11px] flex items-center gap-1 shadow-2xs">
                                                    🏷️ जुने कर्ज खाते क्र.: <strong className="text-purple-950 font-black">{selectedAccount.legacyAccountNumber}</strong>
                                                </span>
                                            )}
                                            {borrowerLoans.length === 1 && (
                                                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                                                    ✓ एकमेव खाते
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-[11px]">
                                            <span>मंजूर रक्कम: <strong className="text-slate-800">₹{(selectedAccount.sanctionedAmount || 0).toLocaleString('en-IN')}</strong></span>
                                            <span>मुद्दल बाकी: <strong className="text-rose-700 font-bold">₹{(selectedAccount.principalBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                                            <span>थकीत/चालू व्याज: <strong className="text-amber-800 font-bold">₹{(selectedAccount.interestBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                                            {selectedAccount.installmentAmount > 0 && (
                                                <span>नियमित हप्ता: <strong className="text-emerald-700 font-bold">₹{(selectedAccount.installmentAmount || 0).toLocaleString('en-IN')}</strong></span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Multi-Loan Selection Inline Grid */}
                                {borrowerLoans.length > 1 && (
                                    <div className="mt-2.5 bg-gradient-to-b from-blue-50/70 via-slate-50 to-white rounded-sm border border-blue-200/80 p-2.5 shadow-2xs">
                                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                                                <span className="p-1 rounded-sm bg-primary text-white">
                                                    <Layers size={13} />
                                                </span>
                                                <span>खातेदाराची {borrowerLoans.length} कर्ज खाती उपलब्ध (हप्ता भरण्यासाठी खालील ग्रिडमधून कर्ज खाते निवडा):</span>
                                            </div>
                                            {selectedAccount && (
                                                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-sm border border-emerald-300 flex items-center gap-1">
                                                    <CheckCircle size={12} /> चालू निवड: #{format14DigitDisplay(selectedAccount.loanAccountNo)}
                                                    {selectedAccount.legacyAccountNumber && ` (जुना क्र: ${selectedAccount.legacyAccountNumber})`}
                                                </span>
                                            )}
                                        </div>

                                        <div className="overflow-x-auto border border-gray-200 rounded-sm bg-white shadow-2xs">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold border-b border-gray-200 uppercase tracking-wider">
                                                        <th className="py-2 px-3 text-center w-14">निवड</th>
                                                        <th className="py-2 px-3">कर्ज खाते क्र.</th>
                                                        <th className="py-2 px-3">कर्ज प्रकार / योजना</th>
                                                        <th className="py-2 px-3 text-right">मंजूर रक्कम</th>
                                                        <th className="py-2 px-3 text-right">मुद्दल शिल्लक</th>
                                                        <th className="py-2 px-3 text-right">थकीत/चालू व्याज</th>
                                                        <th className="py-2 px-3 text-right">नियमित हप्ता</th>
                                                        <th className="py-2 px-3 text-center">कृती</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {borrowerLoans.map((acc: any) => {
                                                        const isSelected = selectedAccount?.loanAccountID === acc.loanAccountID;
                                                        return (
                                                            <tr
                                                                key={acc.loanAccountID}
                                                                onClick={() => selectLoanAccountById(acc.loanAccountID)}
                                                                className={`cursor-pointer transition-all ${
                                                                    isSelected 
                                                                        ? 'bg-primary/10 font-semibold ring-1 ring-inset ring-primary' 
                                                                        : 'hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <td className="py-2 px-3 text-center">
                                                                    <input
                                                                        type="radio"
                                                                        name="selectedLoanAccountRadio"
                                                                        checked={isSelected}
                                                                        onChange={() => selectLoanAccountById(acc.loanAccountID)}
                                                                        className="w-4 h-4 text-primary focus:ring-primary cursor-pointer accent-primary"
                                                                    />
                                                                </td>
                                                                <td className="py-2 px-3 font-mono font-bold text-gray-900">
                                                                    {format14DigitDisplay(acc.loanAccountNo)}
                                                                    {acc.legacyAccountNumber && (
                                                                        <span className="inline-block ml-1.5 font-mono text-[10px] font-bold text-purple-900 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200 shadow-2xs">
                                                                            🏷️ जुना क्र: {acc.legacyAccountNumber}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="py-2 px-3 text-gray-800">
                                                                    {acc.loanRate?.shortName || acc.loanRate?.loanType || 'कर्ज'}
                                                                </td>
                                                                <td className="py-2 px-3 text-right font-medium text-gray-700">
                                                                    ₹{(acc.sanctionedAmount || 0).toLocaleString('en-IN')}
                                                                </td>
                                                                <td className="py-2 px-3 text-right font-bold text-rose-700">
                                                                    ₹{(acc.principalBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="py-2 px-3 text-right text-amber-800 font-medium">
                                                                    ₹{(acc.interestBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                                                    ₹{(acc.installmentAmount || 0).toLocaleString('en-IN')}
                                                                </td>
                                                                <td className="py-2 px-3 text-center">
                                                                    <span className={`inline-block px-2.5 py-0.5 rounded-sm text-[10px] font-bold transition-all ${
                                                                        isSelected 
                                                                            ? 'bg-emerald-600 text-white shadow-2xs' 
                                                                            : 'bg-white hover:bg-primary hover:text-white text-primary border border-primary/40'
                                                                    }`}>
                                                                        {isSelected ? '✓ निवडलेले' : 'हप्ता घ्या'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {selectedAccount && selectedAccount.loanRate && (
                                    <div className="mt-2 p-2 bg-gradient-to-r from-blue-50/90 via-slate-50 to-indigo-50/90 border border-blue-200/80 rounded-sm shadow-2xs text-[11px] flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-primary text-white tracking-wide">
                                                धोरण (Policy)
                                            </span>
                                            <span className="text-slate-700">
                                                योजना: <strong className="text-primary font-bold">{selectedAccount.loanRate.shortName || selectedAccount.loanRate.loanType}</strong>
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <span className="text-slate-600">
                                                हप्ता: <strong className="text-emerald-800 font-bold">{selectedAccount.loanRate.loanInstallmentType || 'समान हप्ता'}</strong>
                                            </span>
                                            <span className="text-slate-600">
                                                आकारणी: <strong className="text-blue-800 font-bold">{selectedAccount.loanRate.interestCalculationMethod || 'Daily Reducing'}</strong>
                                            </span>
                                            <span className="text-slate-600">
                                                वारंवारता: <strong className="text-purple-800 font-bold">{selectedAccount.loanRate.interestPostingFrequency || 'मासिक'}</strong>
                                            </span>
                                            <span className="bg-white px-2 py-0.5 border border-blue-200 rounded-sm font-medium shadow-2xs">
                                                {selectedAccount.loanRate?.loanInstallmentType?.includes("व्याजवरती") ? "ऑटो चालू थकीत व्याज: " : "नियमित हप्ता: "}
                                                <strong className="text-primary font-mono font-bold">
                                                    ₹{selectedAccount.loanRate?.loanInstallmentType?.includes("व्याजवरती")
                                                        ? ((formData.interestCollected || 0) + (formData.penaltyInterestCollected || 0)).toLocaleString('en-IN')
                                                        : (selectedAccount.installmentAmount || 0).toLocaleString('en-IN')}
                                                </strong>
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {selectedAccount && (
                                    <div className="mt-1 flex items-center justify-between text-[11px] px-1">
                                        <span className="text-gray-600">
                                            कर्ज मूळ शाखा (Home Branch): <strong className="text-gray-800 font-semibold">{selectedAccount.branch?.branchName || `शाखा #${selectedAccount.branchID || '-'}`}</strong>
                                        </span>
                                        {selectedAccount.branchID && selectedAccount.branchID !== selectedBranchId && (
                                            <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3 text-amber-600" /> आंतर-शाखा वसुली (Cross-Branch)
                                            </span>
                                        )}
                                    </div>
                                )}
                                {selectedAccount && selectedAccount.branchID && selectedAccount.branchID !== selectedBranchId && (
                                    <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded text-amber-900 text-xs flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                        <div>
                                            <strong className="font-bold">आंतर-शाखा वसुली (Cross-Branch Collection):</strong> हे कर्ज <strong>{selectedAccount.branch?.branchName || `शाखा #${selectedAccount.branchID}`}</strong> चे आहे. जमा होणारी रोकड <strong>{branches.find(b => b.branchID === selectedBranchId)?.branchName || `शाखा #${selectedBranchId}`}</strong> च्या कॅशियर गल्ल्यात नोंदवली जाईल.
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center mt-2 border-t pt-2 border-gray-100">
                                {formData.paymentMode === 'Bank' && (
                                    <select name="bankAccountLedgerID" value={formData.bankAccountLedgerID || ''} disabled={isPassingMode}
                                        onChange={(e) => {
                                            const ledgerId = parseInt(e.target.value);
                                            const selectedBank = bankLedgers.find(l => l.ledgerID === ledgerId);
                                            setFormData(p => ({ 
                                                ...p, 
                                                bankAccountLedgerID: ledgerId || undefined,
                                                bankName: selectedBank ? selectedBank.ledgerName : undefined
                                            }));
                                        }}
                                        className={`${inputClass} ${isPassingMode ? 'bg-slate-100 cursor-not-allowed' : ''}`} required>
                                        <option value="">-- बँक खाते निवडा (Select Bank A/c) --</option>
                                        {bankLedgers.map(l => (
                                             <option key={l.ledgerID} value={l.ledgerID}>
                                                {l.ledgerName}{l.accountGroup?.groupName ? ` (${l.accountGroup.groupName})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {formData.paymentMode === 'Cheque' && (
                                    <>
                                        <select name="bankAccountLedgerID" value={formData.bankAccountLedgerID || ''} disabled={isPassingMode}
                                            onChange={(e) => {
                                                const ledgerId = parseInt(e.target.value);
                                                const selectedBank = bankLedgers.find(l => l.ledgerID === ledgerId);
                                                setFormData(p => ({ 
                                                    ...p, 
                                                    bankAccountLedgerID: ledgerId || undefined,
                                                    bankName: selectedBank ? selectedBank.ledgerName : undefined
                                                }));
                                            }}
                                            className={`${inputClass} ${isPassingMode ? 'bg-slate-100 cursor-not-allowed' : ''}`} required>
                                            <option value="">-- बँक खाते निवडा (Select Bank A/c) --</option>
                                            {bankLedgers.map(l => (
                                                <option key={l.ledgerID} value={l.ledgerID}>
                                                    {l.ledgerName}{l.accountGroup?.groupName ? ` (${l.accountGroup.groupName})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <input type="text" value={formData.chequeNo || ''} onChange={(e) => setFormData(p => ({ ...p, chequeNo: e.target.value }))} placeholder="चेक नंबर (Cheque No)" disabled={isPassingMode} className={`${inputClass} ${isPassingMode ? 'bg-slate-100 cursor-not-allowed' : ''}`} required />
                                    </>
                                )}
                                {formData.paymentMode === 'Saving Transfer' && (
                                    <input type="text" value={formData.transferFromSavingAccountNo || ''} onChange={(e) => setFormData(p => ({ ...p, transferFromSavingAccountNo: e.target.value }))} placeholder="Saving Account No" disabled={isPassingMode} className={`${inputClass} ${isPassingMode ? 'bg-slate-100 cursor-not-allowed' : ''}`} />
                                )}
                                
                                <label className={labelClass + " whitespace-nowrap !mb-0"}>तपशील</label>
                                <input type="text" value={formData.remarks || ''} onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))} disabled={isPassingMode} className={`${inputClass} ${isPassingMode ? 'bg-slate-100 cursor-not-allowed' : ''}`} placeholder="अधिक माहिती..." />
                            </div>

                            {/* OTS & Interest Waiver Section */}
                            <div className="bg-amber-50/80 p-2 rounded-sm border border-amber-300 mt-2 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isOTS || false}
                                            onChange={(e) => setFormData(p => ({ ...p, isOTS: e.target.checked }))}
                                            disabled={isPassingMode}
                                            className="w-4 h-4 text-amber-600 rounded-sm focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <span className="text-xs font-bold text-amber-900">
                                            🏆 एकरकमी तडजोड (OTS / One Time Settlement) / व्याज सूट सवलत
                                        </span>
                                    </label>
                                    {formData.isOTS && (
                                        <span className="bg-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-sm border border-amber-400">
                                            तडजोड मोड सक्रिय
                                        </span>
                                    )}
                                </div>

                                {(formData.isOTS || (formData.interestWaived && formData.interestWaived > 0)) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-amber-200">
                                        <div>
                                            <label className="block text-[11px] font-bold text-amber-900 mb-1">माफ करावयाचे व्याज (Interest Waived ₹)</label>
                                            <input
                                                type="number"
                                                value={formData.interestWaived || ''}
                                                onChange={(e) => setFormData(p => ({ ...p, interestWaived: parseFloat(e.target.value) || 0 }))}
                                                disabled={isPassingMode}
                                                className={`w-full text-xs border border-amber-300 rounded-sm px-2 py-1 font-bold text-amber-900 focus:outline-none focus:border-amber-600 ${isPassingMode ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-amber-900 mb-1">माफ करावयाचे दंड व्याज (Penalty Waived ₹)</label>
                                            <input
                                                type="number"
                                                value={formData.penaltyWaived || ''}
                                                onChange={(e) => setFormData(p => ({ ...p, penaltyWaived: parseFloat(e.target.value) || 0 }))}
                                                disabled={isPassingMode}
                                                className={`w-full text-xs border border-amber-300 rounded-sm px-2 py-1 font-bold text-amber-900 focus:outline-none focus:border-amber-600 ${isPassingMode ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-amber-900 mb-1">
                                                संचालक मंडळ ठराव / मंजुरी क्र. (Resolution No) <span className="text-red-600 font-extrabold">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.resolutionNo || ''}
                                                onChange={(e) => setFormData(p => ({ ...p, resolutionNo: e.target.value }))}
                                                disabled={isPassingMode}
                                                className={`w-full text-xs border border-amber-300 rounded-sm px-2 py-1 font-bold text-amber-900 focus:outline-none focus:border-amber-600 ${isPassingMode ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                                                placeholder="उदा. BR-2026/45 (आवश्यक)"
                                                required
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Account Details */}
                    {accountDetails && (
                        <div className="border border-gray-300 bg-white rounded-sm shadow-xs overflow-hidden mb-1">
                            <div className="flex flex-wrap justify-between items-center bg-primary/5 p-2 border-b border-primary/20 gap-3">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-500 font-bold">मंजूर मर्यादा</span> 
                                    <span className="text-gray-900 font-bold text-xs">₹ {accountDetails.sanctionedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex flex-col border-l border-gray-300 pl-3">
                                    <span className="text-[10px] text-primary font-bold flex items-center gap-1">
                                        एकूण वाटप
                                        {accountDetails.disbursementCount && accountDetails.disbursementCount > 1 ? (
                                            <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-sm border border-amber-300 font-bold">
                                                {accountDetails.disbursementCount} टप्पे
                                            </span>
                                        ) : null}
                                    </span> 
                                    <span className="text-primary font-extrabold text-xs">
                                        ₹ {(accountDetails.totalDisbursedAmount || accountDetails.currentPrincipalBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                {(accountDetails.pendingSanctionedAmount || 0) > 0 && (
                                    <div className="flex flex-col border-l border-gray-300 pl-3">
                                        <span className="text-[10px] text-purple-700 font-bold">शिल्लक मंजुरी</span> 
                                        <span className="text-purple-800 font-extrabold text-xs bg-purple-50 px-1.5 py-0.2 rounded-sm border border-purple-200">
                                            ₹ {accountDetails.pendingSanctionedAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}
                                <div className="flex flex-col border-l border-gray-300 pl-3">
                                    <span className="text-[10px] text-emerald-800 font-bold">चालू मुद्दल शिल्लक</span> 
                                    <span className="text-emerald-900 font-extrabold text-sm">
                                        ₹ {accountDetails.currentPrincipalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex flex-col border-l border-gray-300 pl-3">
                                    <span className="text-[10px] text-rose-600 font-bold">३१/३ अखेर बाकी</span> 
                                    <span className="text-rose-700 font-bold text-xs">₹ {accountDetails.march31Balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {npaStatus && (
                                    <div className="flex flex-col border-l border-gray-300 pl-3">
                                        <span className="text-[10px] text-purple-600 font-bold">NPA स्थिती</span> 
                                        <span className={`font-bold text-xs ${npaStatus.category === 'Standard' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            {npaStatus.categoryMarathi}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center ml-auto">
                                    <button
                                        type="button"
                                        onClick={() => setShowInstallmentModal(true)}
                                        className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-3 py-1 rounded-sm text-xs font-bold shadow-xs transition-colors cursor-pointer"
                                        title="कर्ज हप्ता परतफेड वेळापत्रक चार्ट पहा"
                                    >
                                        <Calendar size={13} />
                                        <span>📅 हप्ता चार्ट पहा</span>
                                        {accountDetails.schedule && accountDetails.schedule.length > 0 && (
                                            <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-sm font-mono font-bold ml-0.5">
                                                {accountDetails.schedule.length} हप्ते
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Tranche breakdown banner if multiple disbursements */}
                            {accountDetails.tranches && accountDetails.tranches.length > 1 && (
                                <div className="bg-amber-50/80 border-t border-amber-200 px-3 py-1.5 text-[11px] flex flex-wrap items-center gap-2.5">
                                    <span className="font-bold text-amber-950 flex items-center gap-1">
                                        <span>⚡</span>
                                        <span>टप्पानिहाय वाटप तपशील:</span>
                                    </span>
                                    {accountDetails.tranches.map((t, idx) => (
                                        <span key={t.disbursementID} className="bg-white px-2 py-0.5 rounded-sm border border-amber-300 text-slate-800 font-medium shadow-2xs">
                                            टप्पा {idx + 1}: <strong className="text-emerald-700">₹{t.disbursementAmount.toLocaleString('en-IN')}</strong> ({new Date(t.disbursementDate).toLocaleDateString('en-GB')})
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Middle Overdue Table */}
                    <div className="border border-gray-300 bg-white min-h-[120px] rounded-sm shadow-xs overflow-x-auto mt-1">
                        <table className="w-full text-[10px] text-center border-collapse">
                            <thead>
                                <tr className="bg-gray-100 text-primary border-b-2 border-primary font-bold">
                                    <th className="p-1 border-r border-gray-300">कर्ज प्रकार</th>
                                    <th className="p-1 border-r border-gray-300">कर्ज उचल दिनांक</th>
                                    <th className="p-1 border-r border-gray-300 bg-sky-50 text-sky-900 font-bold">व्याज आकारणी पासून</th>
                                    <th className="p-1 border-r border-gray-300">कर्ज उचल रक्कम</th>
                                    <th className="p-1 border-r border-gray-300 text-primary font-bold">हप्त्याची रक्कम</th>
                                    <th className="p-1 border-r border-gray-300">व्याज दर (%)</th>
                                    <th className="p-1 border-r border-gray-300">येणे बाकी</th>
                                    <th className="p-1 border-r border-gray-300">राहिलेला हप्ता (₹)</th>
                                    <th className="p-1 border-r border-gray-300 text-rose-700 bg-rose-50 font-bold">थकीत हफ्ते</th>
                                    <th className="p-1 border-r border-gray-300 text-rose-700">थकीत हप्ता दिनांक</th>
                                    <th className="p-1 border-r border-gray-300 bg-rose-50 text-rose-700">पैकी थकबाकी</th>
                                    <th className="p-1 border-r border-gray-300 text-orange-700">व्याज</th>
                                    <th className="p-1 border-r border-gray-300">येणे व्याज</th>
                                    <th className="p-1 border-r border-gray-300">दंड व्याज</th>
                                    <th className="p-1 border-r border-gray-300">सरचार्ज</th>
                                    <th className="p-1 border-r border-gray-300">वसुली फी</th>
                                    <th className="p-1 border-r border-gray-300">दिवस</th>
                                    <th className="p-1 border-r border-gray-300 font-bold text-primary">शिल्लक कर्ज रक्कम</th>
                                    <th className="p-1 bg-amber-100 text-amber-900 font-bold">एकूण देय रक्कम (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                 {selectedAccount ? (
                                     (() => {
                                         const loanRate = selectedAccount.loanRate;
                                         const isDailyReducing = loanRate && 
                                             (loanRate.interestCalculationMethod?.includes("Daily Reducing") || loanRate.interestCalculationMethod?.includes("दैनिक घटती"));

                                         const disbursementDate = accountDetails?.disbursementDate || selectedAccount.loanDisbursementDate || selectedAccount.openingDate;
                                         const totalDisbursed = accountDetails?.totalDisbursedAmount || accountDetails?.sanctionedAmount || selectedAccount.sanctionedAmount;
                                         const sanctionedAmount = accountDetails?.sanctionedAmount || selectedAccount.sanctionedAmount;
                                         const interestRate = selectedAccount.loanRate?.interestRate || selectedAccount.interestRate || 0;
                                         const yeneBaki = accountDetails?.currentPrincipalBalance !== undefined ? accountDetails.currentPrincipalBalance : (selectedAccount.principalBalance || 0);

                                         let thakitDinank = "-";
                                         let vasulpatra = 0;
                                         let paikiThakbaki = 0;
                                         let vyaj = 0;
                                         let yeneVyaj = accountDetails?.currentInterestBalance !== undefined ? accountDetails.currentInterestBalance : (selectedAccount.interestBalance || 0);
                                         let dandVyaj = accountDetails?.currentOverdueInterestBalance !== undefined ? accountDetails.currentOverdueInterestBalance : (selectedAccount.overdueInterestBalance || 0);
                                         let surcharge = 0;
                                         let vasuliFee = 0;

                                         const collectionDateObj = parseDateSafe(formData.collectionDate || new Date());
                                         collectionDateObj.setHours(0, 0, 0, 0);

                                         let thakitHapteCount = 0;
                                         if (accountDetails?.schedule && accountDetails.schedule.length > 0) {
                                             thakitHapteCount = accountDetails.schedule.filter(s => {
                                                 const dDate = parseDateSafe(s.dueDate);
                                                 dDate.setHours(0, 0, 0, 0);
                                                 return dDate <= collectionDateObj && s.status !== 'Paid';
                                             }).length;
                                         }

                                         if (!isDailyReducing && accountDetails?.schedule && accountDetails.schedule.length > 0) {
                                             // Filter unpaid installments that are due up to the collection date
                                             const overdueInstallments = accountDetails.schedule.filter(s => {
                                                 const dueDateObj = parseDateSafe(s.dueDate);
                                                 dueDateObj.setHours(0, 0, 0, 0);
                                                 return dueDateObj <= collectionDateObj && s.status !== 'Paid';
                                             });

                                             if (overdueInstallments.length > 0) {
                                                 vasulpatra = overdueInstallments.reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
                                                 paikiThakbaki = overdueInstallments
                                                     .filter(s => {
                                                         const dDate = parseDateSafe(s.dueDate);
                                                         dDate.setHours(0, 0, 0, 0);
                                                         return dDate < collectionDateObj;
                                                     })
                                                     .reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
                                                 vyaj = overdueInstallments.reduce((sum, s) => sum + s.interestAmount, 0);
                                             } else {
                                                 // No overdue installments yet, show the first upcoming pending installment details
                                                 const nextInstallment = accountDetails.schedule.find(s => s.status !== 'Paid');
                                                 if (nextInstallment) {
                                                      vasulpatra = nextInstallment.remainingPrincipal !== undefined ? nextInstallment.remainingPrincipal : (nextInstallment.principalAmount || 0);
                                                      vyaj = nextInstallment.interestAmount || 0;
                                                 }
                                             }
                                         } else {
                                             // Dynamic daily Reducing balance calculations
                                             const rate = selectedAccount.loanRate?.interestRate || selectedAccount.interestRate || 0;
                                             const principal = yeneBaki;
                                             const fromDateStr = getInterestStartDate(selectedAccount);
                                            if (fromDateStr) {
                                                const diffDays = calculateElapsedDays(fromDateStr, formData.collectionDate);
                                                if (diffDays > 0) {
                                                    vyaj = Math.round((principal * rate * diffDays) / 36500);
                                                }
                                            }

                                             if (accountDetails?.schedule) {
                                                 paikiThakbaki = accountDetails.schedule
                                                     .filter(s => parseDateSafe(s.dueDate) <= collectionDateObj && s.status !== 'Paid')
                                                     .reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
                                                 vasulpatra = paikiThakbaki;
                                             }
                                         }

                                         if (vasulpatra > yeneBaki) vasulpatra = yeneBaki;
                                         if (paikiThakbaki > yeneBaki) paikiThakbaki = yeneBaki;

                                         if (accountDetails?.schedule && accountDetails.schedule.length > 0) {
                                             const firstUnpaid = accountDetails.schedule.find(s => s.status !== 'Paid');
                                             if (firstUnpaid) {
                                                 const dDate = parseDateSafe(firstUnpaid.dueDate);
                                                 dDate.setHours(0,0,0,0);
                                                 if (isDailyReducing || dDate < collectionDateObj) {
                                                     thakitDinank = formatDateSafe(dDate); 
                                                 }
                                             }
                                         }

                                         // Calculate actual elapsed days for display
                                        let days = 0;
                                        const fromDateStrGrid = getInterestStartDate(selectedAccount);
                                        if (fromDateStrGrid) {
                                            days = calculateElapsedDays(fromDateStrGrid, formData.collectionDate);
                                        }

                                         // Calculate Remaining Loan Amount (शिल्लक कर्ज रक्कम)
                                         const shillakKarjRakkam = Math.max(0, yeneBaki - (formData.principalCollected || 0));

                                         // Calculate Total Recoverable (एकूण वसुलपात्र)
                                         const ekunVasulpatra = vasulpatra + vyaj + yeneVyaj + dandVyaj + surcharge + vasuliFee;

                                         return (
                                             <tr className="border-b border-gray-200 hover:bg-gray-50">
                                                 <td className="p-1.5 border-r border-gray-200 font-semibold">{selectedAccount.loanRate?.shortName || selectedAccount.loanRate?.loanType || 'N/A'}</td>
                                                 <td className="p-1.5 border-r border-gray-200">{disbursementDate ? formatDateSafe(disbursementDate) : ''}</td>
                                                <td className="p-1.5 border-r border-gray-200 font-mono text-sky-800 font-bold bg-sky-50/50">
                                                    {fromDateStrGrid ? formatDateSafe(fromDateStrGrid) : '-'}
                                                </td>
                                                <td className="p-1.5 border-r border-gray-200 font-mono font-semibold">{totalDisbursed.toFixed(2)}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono font-bold text-primary">{(selectedAccount.installmentAmount || 0).toFixed(2)}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono">{interestRate.toFixed(2)}%</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono font-semibold text-slate-700">{yeneBaki.toFixed(2)}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono">{vasulpatra.toFixed(2)}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono font-extrabold text-rose-700 bg-rose-50">{thakitHapteCount}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono text-rose-600">{thakitDinank}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono text-rose-600 font-bold bg-rose-50/50">{paikiThakbaki.toFixed(2)}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono font-semibold text-orange-600">{vyaj.toFixed(2)}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono">{yeneVyaj.toFixed(2)}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono">{dandVyaj.toFixed(2)}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono">{surcharge.toFixed(2)}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono">{vasuliFee.toFixed(2)}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono font-semibold" title={`व्याज दिवस: ${fromDateStrGrid ? formatDateSafe(fromDateStrGrid) : ''} ते ${formatDateSafe(formData.collectionDate || new Date())} (${days} दिवस, भरणा दिनांक वगळून)`}>
                                                    {days}
                                                </td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono font-bold text-primary">{shillakKarjRakkam.toFixed(2)}</td>
                                                 <td className="p-1.5 font-mono font-bold bg-amber-100 text-amber-900 text-xs">{ekunVasulpatra.toFixed(2)}</td>
                                             </tr>
                                         );
                                     })()
                                 ) : (
                                     <tr>
                                         <td colSpan={19} className="p-8 text-gray-400 italic">कृपया खाते निवडा (Select Account)</td>
                                     </tr>
                                 )}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom Area - Actions & Summary */}
                    <div className="flex flex-col md:flex-row gap-2.5">
                        {/* Actions */}
                        {isPassingMode ? (
                            <div className="w-full md:w-1/4 flex flex-col gap-2 p-2.5 bg-amber-50/80 border-2 border-amber-400 rounded-sm shadow-xs">
                                <div className="text-[11px] font-bold text-amber-900 border-b border-amber-200 pb-1 flex items-center justify-between">
                                    <span>पासिंग / मंजुरी पर्याय</span>
                                    <span className="bg-amber-200 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">Passing Mode</span>
                                </div>

                                <button 
                                    type="button" 
                                    onClick={handlePassVoucher}
                                    disabled={passingActionLoading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2.5 px-3 rounded-sm shadow-md transition-all flex justify-center items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <CheckCircle size={15} />
                                    <span>{passingActionLoading ? 'पास होत आहे...' : '✅ पावती पास करा (Approve & Pass)'}</span>
                                </button>

                                <button 
                                    type="button" 
                                    onClick={() => setRejectModalOpen(true)}
                                    disabled={passingActionLoading}
                                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 px-3 rounded-sm shadow-xs transition-colors flex justify-center items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <Trash2 size={14} />
                                    <span>❌ पावती रिजेक्ट करा (Reject)</span>
                                </button>

                                <button 
                                    type="button" 
                                    onClick={() => onNavigate ? onNavigate('voucher-posting') : window.location.href = '/?tab=voucher-posting'}
                                    disabled={passingActionLoading}
                                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold py-2 px-3 rounded-sm shadow-2xs transition-colors flex justify-center items-center gap-1.5 cursor-pointer"
                                >
                                    <span>↩️ मागे जा (Back to Queue)</span>
                                </button>

                                <button 
                                    type="button" 
                                    onClick={handlePrintClick} 
                                    className="bg-slate-600 hover:bg-slate-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-sm shadow-xs transition-colors flex justify-center items-center gap-1 cursor-pointer mt-1"
                                >
                                    <Printer size={13} /> 🖨️ प्रिंट पूर्वावलोकन (Preview)
                                </button>
                            </div>
                        ) : (
                            <div className="w-full md:w-1/4 flex flex-col gap-1.5">
                                <button type="submit" className="bg-primary hover:bg-primary/90 text-white text-[11px] font-bold py-1.5 px-3 rounded-sm shadow-xs transition-colors flex justify-center items-center gap-1 cursor-pointer">
                                    <Save size={14} /> जतन (Save)
                                </button>
                                <button type="button" onClick={() => {
                                    setFormData({
                                        collectionDate: new Date().toISOString().split('T')[0],
                                        receiptNo: '',
                                        paymentMode: "Cash",
                                        totalAmountReceived: 0,
                                        surchargeCollected: 0,
                                        penaltyInterestCollected: 0,
                                        receivableInterestCollected: 0,
                                        interestCollected: 0,
                                        principalCollected: 0,
                                        fees: []
                                    });
                                    setSelectedCustomerId(null);
                                    setSelectedBorrowerKey(null);
                                    setSelectedAccount(null);
                                    setAccountDetails(null);
                                    (window as any).selectedLoanCustomerId = undefined;
                                    (window as any).selectedLoanAccountId = undefined;
                                    (window as any).selectedLoanMemberId = undefined;
                                    setLastSavedCollectionId(null);
                                    fetchNextReceiptNo(selectedBranchId);
                                }} className="bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-bold py-1.5 px-3 rounded-sm shadow-xs transition-colors flex justify-center items-center gap-1 cursor-pointer">
                                    <PlusCircle size={14} /> नवीन पावती (New)
                                </button>
                                <button type="button" onClick={handlePrintClick} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-sm shadow-xs transition-colors flex justify-center items-center gap-1 cursor-pointer">
                                    <Printer size={14} /> प्रिंट (Print)
                                </button>
                                <button type="button" onClick={() => {
                                    if (lastSavedCollectionId) {
                                        const found = collections.find(c => c.loanCollectionID === lastSavedCollectionId);
                                        if (found) handleDirectWhatsAppShare(found);
                                        else alert('पावती सापडली नाही.');
                                    } else {
                                        alert('कृपया आधी जमा माहिती जतन (Save) करा.');
                                    }
                                }} className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-sm shadow-xs transition-colors flex justify-center items-center gap-1 cursor-pointer">
                                    <span>📲</span> WhatsApp पाठवा
                                </button>
                                <button type="button" onClick={() => setShowReceiptsModal(true)} className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-[11px] font-bold py-1.5 px-3 rounded-sm shadow-xs transition-colors flex justify-center items-center gap-1 mt-0.5 cursor-pointer">
                                    <Search size={14} /> सर्व जमापावती पहा
                                </button>
                            </div>
                        )}
                        
                        {/* Summary Table */}
                        <div className="w-full md:w-3/4 border border-gray-300 bg-white rounded-sm shadow-xs overflow-hidden text-[11px]">
                            <div className="bg-primary text-white font-bold text-center py-1 border-b border-primary/20 text-xs">
                                दिवसाचा आलेला वसूल (Today's Recovery Summary)
                            </div>
                            <table className="w-full text-center">
                                <thead>
                                    <tr className="border-b border-gray-300 bg-gray-100 text-primary">
                                        <th className="py-1 border-r border-gray-300 font-bold">खाते प्रकार (Type)</th>
                                        <th className="py-1 border-r border-gray-300 font-bold text-emerald-700">Cash (रोख)</th>
                                        <th className="py-1 border-r border-gray-300 font-bold text-primary">Trans (बँक / इतर)</th>
                                        <th className="py-1 font-bold text-slate-900">एकूण (Total)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="hover:bg-gray-50 transition-colors">
                                        <td className="py-1.5 border-r border-gray-200 text-gray-800 font-bold">Total Collections</td>
                                        <td className="py-1.5 border-r border-gray-200 font-bold text-emerald-700">₹ {todayTotalCash.toFixed(2)}</td>
                                        <td className="py-1.5 border-r border-gray-200 font-bold text-primary">₹ {todayTotalBank.toFixed(2)}</td>
                                        <td className="py-1.5 font-bold text-sm text-primary">₹ {(todayTotalCash + todayTotalBank).toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                </div>
            </div>
            </form>

            {/* Installment Schedule Modal Window - Matching Smart Banking ERP Theme */}
            {showInstallmentModal && selectedAccount && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 animate-in fade-in duration-150">
                    <div className="bg-white rounded-sm shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-300">
                        {/* Modal Header */}
                        <div className="bg-primary text-white p-2.5 flex justify-between items-center rounded-t-sm shadow-xs border-b border-primary/30">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-white/10 rounded-sm">
                                    <Calendar className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold flex items-center gap-2">
                                        कर्ज हप्ता परतफेड वेळापत्रक चार्ट (Loan Installment Schedule)
                                        <span className="bg-white/20 text-white text-[11px] px-2 py-0.5 rounded-sm font-mono font-bold">
                                            {selectedAccount.loanAccountNo}
                                        </span>
                                    </h2>
                                    <p className="text-[11px] text-white/90 mt-0.5 flex flex-wrap items-center gap-2">
                                        <span>सभासद: <strong className="text-white">{selectedAccount.member?.firstName} {selectedAccount.member?.lastName}</strong></span>
                                        <span>•</span>
                                        <span>कर्ज प्रकार: <strong className="text-white">{selectedAccount.loanRate?.shortName || selectedAccount.loanRate?.loanType || '-'}</strong></span>
                                        <span>•</span>
                                        <span>मंजूर रक्कम: <strong className="text-white">₹{(accountDetails?.sanctionedAmount || selectedAccount.sanctionedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                                        <span>•</span>
                                        <span>व्याजदर: <strong className="text-white">{selectedAccount.loanRate?.interestRate || selectedAccount.interestRate || 0}%</strong></span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-sm text-xs font-bold transition-colors flex items-center gap-1 border border-white/30 cursor-pointer"
                                >
                                    <Printer size={13} /> प्रिंट
                                </button>
                                <button
                                    onClick={() => setShowInstallmentModal(false)}
                                    className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded-sm transition-colors cursor-pointer"
                                    title="बंद करा"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-2.5 overflow-y-auto flex-1 bg-gray-50 flex flex-col gap-2.5">
                            {/* KPI Summary Cards */}
                            {(() => {
                                const schedule = accountDetails?.schedule || [];
                                const totalCount = schedule.length;
                                const totalPrincipal = schedule.reduce((sum, s) => sum + (s.principalAmount || 0), 0);
                                const totalInterest = schedule.reduce((sum, s) => sum + (s.interestAmount || 0), 0);
                                const totalEMI = schedule.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

                                const paidList = schedule.filter(s => s.status === 'Paid');
                                const paidCount = paidList.length;
                                const paidPrincipal = paidList.reduce((sum, s) => sum + (s.paidPrincipal || s.principalAmount || 0), 0);
                                const paidTotal = paidList.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

                                const partialList = schedule.filter(s => s.status === 'Partially Paid');
                                const partialCount = partialList.length;
                                const partialPaidPrincipal = partialList.reduce((sum, s) => sum + (s.paidPrincipal || 0), 0);

                                const collectionDateObj = parseDateSafe(formData.collectionDate || new Date());
                                collectionDateObj.setHours(0, 0, 0, 0);

                                const overdueList = schedule.filter(s => {
                                    if (s.status === 'Paid') return false;
                                    const dDate = parseDateSafe(s.dueDate);
                                    dDate.setHours(0, 0, 0, 0);
                                    return s.status === 'Overdue' || (dDate <= collectionDateObj && s.status !== 'Paid');
                                });
                                const overdueCount = overdueList.length;
                                const overduePrincipal = overdueList.reduce((sum, s) => sum + (s.remainingPrincipal || s.principalAmount || 0), 0);

                                const pendingList = schedule.filter(s => s.status !== 'Paid');
                                const pendingCount = pendingList.length;
                                const currentBalance = selectedAccount.principalBalance || 0;

                                return (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                                        {/* 1. Total EMIs */}
                                        <div className="bg-white p-2 rounded-sm border border-slate-200 shadow-xs flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-primary">
                                                <span className="text-[10px] font-bold uppercase tracking-wider">एकूण हप्ते (Total EMIs)</span>
                                                <FileText size={13} />
                                            </div>
                                            <div className="mt-1 flex items-baseline justify-between">
                                                <span className="text-base font-bold text-slate-800">{totalCount}</span>
                                                <span className="text-xs text-primary font-bold">₹ {totalEMI.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-500 mt-0.5 truncate">मुद्दल: ₹{totalPrincipal.toLocaleString('en-IN')} | व्याज: ₹{totalInterest.toLocaleString('en-IN')}</span>
                                        </div>

                                        {/* 2. Paid / Nil EMIs */}
                                        <div className="bg-emerald-50/40 p-2 rounded-sm border border-emerald-300 shadow-xs flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-emerald-800">
                                                <span className="text-[10px] font-bold uppercase tracking-wider">पूर्ण भरले / निल (Nil)</span>
                                                <CheckCircle size={13} />
                                            </div>
                                            <div className="mt-1 flex items-baseline justify-between">
                                                <span className="text-base font-bold text-emerald-700">{paidCount}</span>
                                                <span className="text-xs text-emerald-700 font-bold">₹ {paidPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <span className="text-[10px] text-emerald-700 mt-0.5 truncate">हप्ते निल झाले: {paidCount} / {totalCount}</span>
                                        </div>

                                        {/* 3. Partially Paid EMIs */}
                                        <div className="bg-amber-50/40 p-2 rounded-sm border border-amber-300 shadow-xs flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-amber-800">
                                                <span className="text-[10px] font-bold uppercase tracking-wider">अंशतः भरले (Partial)</span>
                                                <Clock size={13} />
                                            </div>
                                            <div className="mt-1 flex items-baseline justify-between">
                                                <span className="text-base font-bold text-amber-800">{partialCount}</span>
                                                <span className="text-xs text-amber-800 font-bold">₹ {partialPaidPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <span className="text-[10px] text-amber-700 mt-0.5 truncate">अंशतः वसूल मुद्दल</span>
                                        </div>

                                        {/* 4. Overdue EMIs */}
                                        <div className="bg-rose-50/40 p-2 rounded-sm border border-rose-300 shadow-xs flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-rose-700">
                                                <span className="text-[10px] font-bold uppercase tracking-wider">आजअखेर थकीत (Overdue)</span>
                                                <AlertCircle size={13} />
                                            </div>
                                            <div className="mt-1 flex items-baseline justify-between">
                                                <span className="text-base font-bold text-rose-700">{overdueCount}</span>
                                                <span className="text-xs text-rose-700 font-bold">₹ {overduePrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <span className="text-[10px] text-rose-600 mt-0.5 truncate">थकीत मुद्दल रक्कम</span>
                                        </div>

                                        {/* 5. Pending Principal Balance */}
                                        <div className="bg-blue-50/40 p-2 rounded-sm border border-blue-200 shadow-xs flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-primary">
                                                <span className="text-[10px] font-bold uppercase tracking-wider">शिल्लक मुद्दल (Balance)</span>
                                                <Calendar size={13} />
                                            </div>
                                            <div className="mt-1 flex items-baseline justify-between">
                                                <span className="text-base font-bold text-primary">{pendingCount} <span className="text-[10px] text-gray-500 font-normal">हप्ते</span></span>
                                                <span className="text-xs text-primary font-black">₹ {currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-600 mt-0.5 truncate">चालू कर्ज बाकी</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Filter Tabs */}
                            <div className="flex flex-wrap justify-between items-center bg-white p-1.5 rounded-sm border border-slate-200 gap-1.5 shadow-xs">
                                <div className="flex items-center gap-1">
                                    <span className="text-[11px] font-bold text-gray-600 mr-1">फिल्टर:</span>
                                    {(['ALL', 'PAID', 'PARTIAL', 'OVERDUE', 'PENDING'] as const).map(filter => {
                                        const schedule = accountDetails?.schedule || [];
                                        const collectionDateObj = parseDateSafe(formData.collectionDate || new Date());
                                        collectionDateObj.setHours(0, 0, 0, 0);

                                        let count = schedule.length;
                                        if (filter === 'PAID') {
                                            count = schedule.filter(s => s.status === 'Paid').length;
                                        } else if (filter === 'PARTIAL') {
                                            count = schedule.filter(s => s.status === 'Partially Paid').length;
                                        } else if (filter === 'OVERDUE') {
                                            count = schedule.filter(s => {
                                                if (s.status === 'Paid') return false;
                                                const dDate = parseDateSafe(s.dueDate);
                                                dDate.setHours(0, 0, 0, 0);
                                                return s.status === 'Overdue' || (dDate <= collectionDateObj && s.status !== 'Paid');
                                            }).length;
                                        } else if (filter === 'PENDING') {
                                            count = schedule.filter(s => s.status !== 'Paid').length;
                                        }

                                        const labels = {
                                            ALL: 'सर्व हप्ते',
                                            PAID: '🟢 पूर्ण भरले (Nil)',
                                            PARTIAL: '🟡 अंशतः भरले',
                                            OVERDUE: '🔴 थकीत (Overdue)',
                                            PENDING: '🔵 येणे बाकी'
                                        };

                                        const isActive = modalFilter === filter;
                                        return (
                                            <button
                                                key={filter}
                                                type="button"
                                                onClick={() => setModalFilter(filter)}
                                                className={`px-2 py-0.5 rounded-sm text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                                                    isActive
                                                        ? 'bg-primary text-white shadow-xs'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                                                }`}
                                            >
                                                {labels[filter]}
                                                <span className={`text-[9px] px-1 py-0.2 rounded-sm font-mono ${
                                                    isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-800'
                                                }`}>
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="text-[11px] text-gray-600 font-medium">
                                    हप्ता वारंवारता: <span className="font-bold text-gray-800">{selectedAccount.loanRate?.loanInstallmentType || 'मासिक'}</span> | प्रकार: <span className="font-bold text-primary">{selectedAccount.loanRate?.shortName || selectedAccount.loanRate?.loanType}</span>
                                </div>
                            </div>

                            {/* Detailed Schedule Table */}
                            <div className="bg-white rounded-sm border border-gray-300 shadow-xs overflow-hidden flex-1 max-h-[420px] overflow-y-auto">
                                <table className="w-full text-[11px] text-center border-collapse">
                                    <thead className="bg-gray-100 text-primary border-b-2 border-primary sticky top-0 shadow-xs z-10 font-bold">
                                        <tr>
                                            <th className="p-1.5 border-r border-gray-300 w-12">हप्ता क्र.</th>
                                            <th className="p-1.5 border-r border-gray-300">देय दिनांक (Due Date)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right">सुरुवातीची बाकी</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right text-primary font-bold">मुद्दल हप्ता (₹)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right text-orange-800 font-bold">हप्ता व्याज (₹)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right bg-primary/10 text-primary font-bold">एकूण हप्ता (EMI ₹)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right text-emerald-800 font-bold">भरलेली मुद्दल (₹)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right text-rose-700 font-bold">शिल्लक मुद्दल (₹)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right text-gray-800 font-bold">अखेरची बाकी (₹)</th>
                                            <th className="p-1.5 border-r border-gray-300">पावती / दिनांक</th>
                                            <th className="p-1.5 min-w-[130px]">हप्ता स्थिती (Status)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {(() => {
                                            const schedule = accountDetails?.schedule || [];
                                            const collectionDateObj = parseDateSafe(formData.collectionDate || new Date());
                                            collectionDateObj.setHours(0, 0, 0, 0);

                                            const filteredSchedule = schedule.filter(s => {
                                                if (modalFilter === 'ALL') return true;
                                                if (modalFilter === 'PAID') return s.status === 'Paid';
                                                if (modalFilter === 'PARTIAL') return s.status === 'Partially Paid';
                                                if (modalFilter === 'PENDING') return s.status !== 'Paid';
                                                if (modalFilter === 'OVERDUE') {
                                                    if (s.status === 'Paid') return false;
                                                    const dDate = parseDateSafe(s.dueDate);
                                                    dDate.setHours(0, 0, 0, 0);
                                                    return s.status === 'Overdue' || (dDate <= collectionDateObj && s.status !== 'Paid');
                                                }
                                                return true;
                                            });

                                            if (filteredSchedule.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={11} className="p-6 text-center text-gray-500 italic">
                                                            या फिल्टर अंतर्गत कोणताही हप्ता उपलब्ध नाही.
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            return filteredSchedule.map(row => {
                                                const dDate = parseDateSafe(row.dueDate);
                                                dDate.setHours(0, 0, 0, 0);
                                                const isPaid = row.status === 'Paid';
                                                const isPartial = row.status === 'Partially Paid';
                                                const isOverdue = !isPaid && (row.status === 'Overdue' || dDate <= collectionDateObj);

                                                const paidPrincipal = row.paidPrincipal !== undefined ? row.paidPrincipal : (isPaid ? row.principalAmount : 0);
                                                const remainingPrincipal = row.remainingPrincipal !== undefined ? row.remainingPrincipal : (isPaid ? 0 : row.principalAmount);

                                                return (
                                                    <tr
                                                        key={row.installmentNo}
                                                        className={`transition-colors ${
                                                            isPaid
                                                                ? 'bg-emerald-50/40 hover:bg-emerald-100/50 text-slate-800'
                                                                : isPartial
                                                                ? 'bg-amber-50/50 hover:bg-amber-100/60 font-medium'
                                                                : isOverdue
                                                                ? 'bg-rose-50/50 hover:bg-rose-100/60 font-medium'
                                                                : 'hover:bg-primary/5 text-slate-700'
                                                        }`}
                                                    >
                                                        {/* Installment No */}
                                                        <td className="p-1 border-r border-gray-200 font-bold text-gray-700">
                                                            #{row.installmentNo}
                                                        </td>
                                                        {/* Due Date */}
                                                        <td className="p-1 border-r border-gray-200 font-mono font-medium">
                                                            {formatDateSafe(row.dueDate)}
                                                        </td>
                                                        {/* Opening Balance */}
                                                        <td className="p-1 border-r border-gray-200 text-right text-gray-600 font-mono">
                                                            ₹ {((row.openingBalance ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Principal Amount */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-bold text-primary font-mono">
                                                            ₹ {row.principalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Interest Amount */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-semibold text-orange-800 font-mono">
                                                            ₹ {row.interestAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Total EMI */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-bold text-primary bg-primary/5 font-mono">
                                                            ₹ {row.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Paid Principal */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-bold text-emerald-700 font-mono">
                                                            ₹ {paidPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Remaining Principal */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-bold text-rose-700 font-mono">
                                                            ₹ {remainingPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Closing Balance */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-semibold text-gray-800 font-mono">
                                                            ₹ {((row.closingBalance ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Receipt No & Paid Date */}
                                                        <td className="p-1 border-r border-gray-200 text-[10px]">
                                                            {row.receiptNo || row.paidDate ? (
                                                                <div className="flex flex-col items-center">
                                                                    {row.receiptNo && (
                                                                        <span className="font-mono font-bold text-primary bg-primary/10 px-1 rounded-sm border border-primary/20">
                                                                            {row.receiptNo}
                                                                        </span>
                                                                    )}
                                                                    {row.paidDate && (
                                                                        <span className="text-gray-500 font-mono mt-0.5">
                                                                            {formatDateSafe(row.paidDate)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </td>
                                                        {/* Status Badge */}
                                                        <td className="p-1">
                                                            {isPaid ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                    <CheckCircle size={10} /> पूर्ण भरला (Nil)
                                                                </span>
                                                            ) : isPartial ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                                    <Clock size={10} /> अंशतः भरला
                                                                </span>
                                                            ) : isOverdue ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                                                    <AlertCircle size={10} /> थकीत {row.overdueDays ? `(${row.overdueDays} दि.)` : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                                                    <Calendar size={10} /> आगामी देय
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                    {accountDetails?.schedule && accountDetails.schedule.length > 0 && (
                                        <tfoot className="bg-gray-100 font-bold border-t-2 border-primary sticky bottom-0 z-10 text-slate-800">
                                            <tr>
                                                <td colSpan={3} className="p-1.5 border-r border-gray-300 text-right">
                                                    एकूण हप्ता वेळापत्रक बेरीज (Total Schedule):
                                                </td>
                                                <td className="p-1.5 border-r border-gray-300 text-right text-primary font-bold font-mono">
                                                    ₹ {accountDetails.schedule.reduce((sum, s) => sum + s.principalAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-1.5 border-r border-gray-300 text-right text-orange-800 font-bold font-mono">
                                                    ₹ {accountDetails.schedule.reduce((sum, s) => sum + s.interestAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-1.5 border-r border-gray-300 text-right text-primary font-bold bg-primary/10 font-mono">
                                                    ₹ {accountDetails.schedule.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-1.5 border-r border-gray-300 text-right text-emerald-800 font-bold font-mono">
                                                    ₹ {accountDetails.schedule.reduce((sum, s) => sum + (s.paidPrincipal || (s.status === 'Paid' ? s.principalAmount : 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-1.5 border-r border-gray-300 text-right text-rose-700 font-bold font-mono">
                                                    ₹ {accountDetails.schedule.reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : (s.status === 'Paid' ? 0 : s.principalAmount)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td colSpan={3} className="p-1.5 text-left text-[11px] text-gray-500 italic">
                                                    (एकूण {accountDetails.schedule.length} हप्ते | चालू शिल्लक: ₹{(selectedAccount.principalBalance || 0).toLocaleString('en-IN')})
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-between items-center p-2 bg-gray-100 border-t border-gray-300 rounded-b-sm">
                            <div className="text-[11px] text-gray-600 font-medium flex items-center gap-3">
                                <span>🟢 पूर्ण भरले (Nil): <strong className="text-emerald-700">{accountDetails?.schedule?.filter(s => s.status === 'Paid').length || 0}</strong></span>
                                <span>🟡 अंशतः भरले: <strong className="text-amber-800">{accountDetails?.schedule?.filter(s => s.status === 'Partially Paid').length || 0}</strong></span>
                                <span>🔴 थकीत: <strong className="text-rose-700">{accountDetails?.schedule?.filter(s => {
                                    if (s.status === 'Paid') return false;
                                    const dDate = parseDateSafe(s.dueDate);
                                    dDate.setHours(0, 0, 0, 0);
                                    const cDate = parseDateSafe(formData.collectionDate || new Date());
                                    cDate.setHours(0, 0, 0, 0);
                                    return s.status === 'Overdue' || (dDate <= cDate && s.status !== 'Paid');
                                }).length || 0}</strong></span>
                                <span>🔵 येणे बाकी: <strong className="text-primary">{accountDetails?.schedule?.filter(s => s.status !== 'Paid').length || 0}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-sm text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-gray-300"
                                >
                                    <Printer size={13} /> प्रिंट करा (Print)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowInstallmentModal(false)}
                                    className="px-3.5 py-1 bg-primary hover:bg-primary/90 text-white rounded-sm text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <X size={13} /> बंद करा (Close)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showReceiptsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2">
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-6xl flex flex-col max-h-[90vh]">
                        <div className="bg-primary text-white p-2 flex justify-between items-center rounded-t-sm">
                            <h2 className="text-sm font-bold flex items-center gap-2"><FileText size={16} /> सर्व जमा पावत्या (All Receipts)</h2>
                            <button onClick={() => setShowReceiptsModal(false)} className="hover:text-red-200"><X size={16} /></button>
                        </div>
                        
                        <div className="p-2 flex-1 overflow-auto bg-gray-50">
                            <table className="w-full text-[11px] text-left border-collapse bg-white shadow-sm rounded-sm overflow-hidden">
                                <thead className="bg-gray-100 text-primary border-b-2 border-primary">
                                    <tr>
                                        <th className="p-1 border-r font-bold">दिनांक</th>
                                        <th className="p-1 border-r font-bold">पावती क्र.</th>
                                        <th className="p-1 border-r font-bold">सभासद / खाते</th>
                                        <th className="p-1 border-r font-bold text-right">एकूण रक्कम</th>
                                        <th className="p-1 border-r font-bold">मोड</th>
                                        <th className="p-1 border-r font-bold">शेरा</th>
                                        <th className="p-1 font-bold text-center">कृती (Action)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {collections.map(c => {
                                        const isEditing = editingReceiptId === c.loanCollectionID;
                                        return (
                                            <tr key={c.loanCollectionID} className="border-b hover:bg-blue-50/30 transition-colors">
                                                <td className="p-1 border-r">
                                                    {isEditing ? (
                                                        <input type="date" value={editData.collectionDate?.split('T')[0] || ''} onChange={e => setEditData({...editData, collectionDate: e.target.value})} className="border p-0.5 text-[11px] h-[22px] w-full" />
                                                    ) : new Date(c.collectionDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="p-1 border-r font-semibold">{c.receiptNo}</td>
                                                <td className="p-1 border-r">
                                                    <div>{c.loanAccount?.customer ? `${c.loanAccount.customer.firstName || ''} ${c.loanAccount.customer.lastName || ''}`.trim() : `${c.loanAccount?.member?.firstName || ''} ${c.loanAccount?.member?.lastName || ''}`.trim()}</div>
                                                    <span className="text-[10px] text-gray-500 font-mono block">
                                                        {c.loanAccount?.loanAccountNo} {c.loanAccount?.legacyAccountNumber ? `| जुना क्र: ${c.loanAccount.legacyAccountNumber}` : ''} {c.loanAccount?.customer?.cifNo ? `| CIF: ${c.loanAccount.customer.cifNo}` : (c.loanAccount?.member?.memberCode ? `| ${c.loanAccount.member.memberCode}` : '')}
                                                    </span>
                                                </td>
                                                <td className="p-1 border-r text-right font-bold text-green-700" title={`मुद्दल: ₹${c.principalCollected?.toFixed(2) || '0.00'} | थकीत येणे व्याज: ₹${(c.receivableInterestCollected || 0).toFixed(2)} | चालू व्याज: ₹${c.interestCollected?.toFixed(2) || '0.00'}`}>
                                                    ₹{c.totalAmountReceived.toFixed(2)}
                                                </td>
                                                <td className="p-1 border-r">
                                                    {isEditing ? (
                                                        <select value={editData.paymentMode || 'Cash'} onChange={e => setEditData({...editData, paymentMode: e.target.value})} className="border p-0.5 text-[11px] h-[22px] w-full">
                                                            <option value="Cash">Cash</option>
                                                            <option value="Bank">Bank</option>
                                                        </select>
                                                    ) : c.paymentMode}
                                                </td>
                                                <td className="p-1 border-r text-gray-500">
                                                    {isEditing ? (
                                                        <input type="text" value={editData.remarks || ''} onChange={e => setEditData({...editData, remarks: e.target.value})} className="border p-0.5 text-[11px] h-[22px] w-full" placeholder="शेरा..." />
                                                    ) : c.remarks}
                                                </td>
                                                <td className="p-1 text-center flex justify-center gap-1">
                                                    {isEditing ? (
                                                        <>
                                                            <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white p-1 rounded-sm shadow-sm" title="Save"><Save size={12} /></button>
                                                            <button onClick={() => setEditingReceiptId(null)} className="bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-sm shadow-sm" title="Cancel"><X size={12} /></button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => {
                                                                setEditingReceiptId(c.loanCollectionID);
                                                                setEditData({
                                                                    collectionDate: c.collectionDate,
                                                                    paymentMode: c.paymentMode,
                                                                    remarks: c.remarks || ''
                                                                });
                                                            }} className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded-sm shadow-sm" title="Edit"><Edit size={12} /></button>
                                                            <button onClick={() => setPrintingCollectionId(c.loanCollectionID)} className="bg-primary hover:bg-[#004a75] text-white p-1 rounded-sm shadow-sm" title="Print"><Printer size={12} /></button>
                                                            <button onClick={() => handleDirectWhatsAppShare(c)} className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded-sm shadow-sm flex items-center justify-center" title="WhatsApp वर पाठवा"><span className="text-[10px]">📲</span></button>
                                                            <button onClick={() => handleDeleteReceipt(c.loanCollectionID)} className="bg-red-600 hover:bg-red-700 text-white p-1 rounded-sm shadow-sm" title="Delete"><Trash2 size={12} /></button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {collections.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-2 text-center text-gray-500 italic">कोणतीही पावती उपलब्ध नाही.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Auto Lien Release Confirmation Modal on Loan Closure */}
            {lienPromptData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-3 animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-lg overflow-hidden border border-emerald-500/30">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-3.5 flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-white/20 rounded-full">
                                    <CheckCircle className="text-white" size={20} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold leading-tight">
                                        कर्ज खाते पूर्ण नील झाले! (Loan Fully Settled)
                                    </h2>
                                    <p className="text-[11px] text-emerald-100 font-mono">
                                        खाते क्र.: {lienPromptData.loanAccountNo}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLienPromptData(null)}
                                className="text-white/80 hover:text-white p-1 rounded-sm transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 bg-gray-50/50 space-y-3.5">
                            <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-[12px] text-emerald-900 leading-relaxed">
                                <p className="font-semibold text-emerald-950 mb-1">
                                    🎉 सदर कर्ज खात्याची सर्व येणे मुद्दल व व्याज भरणा पूर्ण झाला असून खाते 'Closed' झाले आहे.
                                </p>
                                <p className="text-emerald-800">
                                    या कर्जापोटी खालील तारण ठेव खात्यांवर बोजा (Lien) नोंदवला आहे. हा बोजा आपण आता <strong className="text-emerald-950 underline">तात्काळ मोकळा (Release)</strong> करू इच्छिता का?
                                </p>
                            </div>

                            {/* Table of Collaterals */}
                            <div className="border border-gray-200 rounded overflow-hidden bg-white shadow-xs">
                                <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-200 text-[11px] font-bold text-gray-700 flex justify-between items-center">
                                    <span>तारण ठेव तपशील (Linked Collaterals)</span>
                                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-semibold">
                                        {lienPromptData.activeCollaterals.length} खाती
                                    </span>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    <table className="w-full text-[11px] text-left border-collapse">
                                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                                            <tr>
                                                <th className="p-2 border-r border-gray-200">ठेव प्रकार</th>
                                                <th className="p-2 border-r border-gray-200 font-mono">खाते क्र.</th>
                                                <th className="p-2 border-r border-gray-200 text-right">बोजा रक्कम (₹)</th>
                                                <th className="p-2 text-center">स्थिती</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {lienPromptData.activeCollaterals.map((c, idx) => (
                                                <tr key={idx} className="hover:bg-emerald-50/30">
                                                    <td className="p-2 border-r border-gray-100 font-medium text-gray-800">
                                                        {getCollateralTypeName(c.collateralType)}
                                                    </td>
                                                    <td className="p-2 border-r border-gray-100 font-mono font-semibold text-primary">
                                                        {c.depositAccountNo}
                                                    </td>
                                                    <td className="p-2 border-r border-gray-100 text-right font-mono font-bold text-gray-800">
                                                        ₹{(c.lienAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-300">
                                                            बोजा नोंदवला
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <p className="text-[11px] text-gray-500 italic">
                                * बोजा तात्काळ मोकळा केल्यास खातेदाराला आपल्या ठेवीवरील रक्कम आहरण किंवा मुदतपूर्ती लाभ त्वरित घेता येईल.
                            </p>
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-3 bg-gray-100 border-t border-gray-200 flex justify-end items-center gap-2">
                            <button
                                type="button"
                                disabled={releasingLien}
                                onClick={() => setLienPromptData(null)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                                नंतर करा (Do Later)
                            </button>
                            <button
                                type="button"
                                disabled={releasingLien}
                                onClick={handleReleaseAllLiens}
                                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {releasingLien ? (
                                    <>मोकळा करत आहे...</>
                                ) : (
                                    <>
                                        <CheckCircle size={14} /> होय, बोजा तात्काळ मोकळा करा
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🛑 Rejection Reason Modal */}
            {rejectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden border border-rose-300 border-t-4 border-t-rose-600 animate-in fade-in zoom-in-95 duration-150">
                        <div className="bg-rose-50 px-4 py-3 border-b border-rose-100 flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-rose-600" />
                            <div>
                                <h3 className="text-sm font-bold text-rose-900">कर्ज पावती नामंजूर / रद्द करा (Reject Collection)</h3>
                                <p className="text-[11px] text-rose-700">पावती / व्हाउचर क्र: <span className="font-mono font-bold">{passingVoucher?.voucherNo || formData.receiptNo || '-'}</span></p>
                            </div>
                        </div>
                        
                        <div className="p-4 space-y-3">
                            <label className="block text-xs font-semibold text-gray-700">
                                नामंजूर करण्याचे कारण लिहा (Reason for Rejection): <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="उदा. रक्कम जुळत नाही / चुकीच्या कर्ज खात्यात जमा केली आहे / चेक बाऊन्स झाला आहे..."
                                rows={3}
                                className="w-full text-xs border border-gray-300 rounded p-2 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                autoFocus
                            />
                        </div>

                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setRejectModalOpen(false);
                                    setRejectionReason('');
                                }}
                                disabled={passingActionLoading}
                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded transition-colors cursor-pointer"
                            >
                                रद्द करा (Cancel)
                            </button>
                            <button
                                type="button"
                                onClick={handleRejectVoucher}
                                disabled={passingActionLoading || !rejectionReason.trim()}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{passingActionLoading ? 'प्रक्रिया सुरू आहे...' : 'नामंजूर निश्चित करा (Confirm Reject)'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Interactive Multi-Loan Account Selector Modal (CIF-First) */}
            {showMultiLoanModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-sm shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-300">
                        {/* Modal Header */}
                        <div className="bg-primary px-4 py-3 text-white flex items-center justify-between border-b border-primary/20 shadow-xs">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-white/15 rounded-sm">
                                    <Layers className="w-5 h-5 text-amber-300" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm flex items-center gap-2">
                                        <span>कर्ज खाते निवडा (Select Loan Account)</span>
                                        <span className="text-[11px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-sm shadow-2xs">
                                            एकूण {customerMatchingLoans.length} कर्ज खाती
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/90 mt-0.5">
                                        खातेदार: <strong className="text-white">{multiLoanCustomerInfo?.name || 'कर्जदार'}</strong>
                                        {multiLoanCustomerInfo?.cifNo && multiLoanCustomerInfo.cifNo !== '-' && (
                                            <span className="ml-2 font-mono text-amber-300 bg-black/20 px-1.5 py-0.5 rounded-sm text-[11px]">
                                                [CIF: {multiLoanCustomerInfo.cifNo}]
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowMultiLoanModal(false)}
                                className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-sm cursor-pointer transition-colors"
                                title="बंद करा"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Sub-header Notice */}
                        <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs text-slate-700">
                            <span className="font-semibold">कृपया वसुली जमा करण्यासाठी योग्य कर्ज खाते निवडा:</span>
                            <span className="text-[11px] text-slate-500 font-medium">खात्यावर किंवा बटनावर क्लिक करा</span>
                        </div>

                        {/* Modal Body: List of Loans */}
                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2.5 bg-slate-50/70">
                            <div className="grid grid-cols-1 gap-2.5">
                                {customerMatchingLoans.map((acc: LoanAccount) => {
                                    const isCurrent = selectedAccount?.loanAccountID === acc.loanAccountID;
                                    const displayAccNo = format14DigitDisplay(acc.loanAccountNo);
                                    const schemeName = acc.loanRate?.shortName || acc.loanRate?.loanType || 'कर्ज योजना';
                                    const loanCategory = (acc.loanRate?.shortName && acc.loanRate?.loanType && acc.loanRate.shortName !== acc.loanRate.loanType)
                                        ? acc.loanRate.loanType
                                        : (acc.loanRate?.loanType || 'विनातारणी');
                                    const interestRate = acc.loanRate?.interestRate || acc.interestRate || 0;
                                    const loanCode = acc.loanRate?.loanCode;

                                    return (
                                        <div
                                            key={acc.loanAccountID}
                                            onClick={() => handleSelectLoanFromModal(acc)}
                                            className={`p-3.5 rounded-sm border text-left cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                                                isCurrent
                                                    ? 'bg-primary/5 border-primary ring-2 ring-primary/40 shadow-sm'
                                                    : 'bg-white hover:bg-slate-50/90 border-slate-200 hover:border-primary/50'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-sm mt-0.5 ${isCurrent ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                                    <CreditCard className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono font-bold text-xs text-slate-900 tracking-wide">
                                                            {displayAccNo}
                                                        </span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                            Active
                                                        </span>
                                                        {acc.legacyAccountNumber && (
                                                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
                                                                🏷️ जुने कर्ज क्र: {acc.legacyAccountNumber}
                                                            </span>
                                                        )}
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/25">
                                                            <Award className="w-3.5 h-3.5 text-primary" />
                                                            योजना: {schemeName}
                                                        </span>
                                                        {loanCode && (
                                                            <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm border border-slate-200">
                                                                कोड: {loanCode}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-600 mt-1.5 flex flex-wrap items-center gap-x-2">
                                                        <span>कर्ज प्रकार: <strong className="text-slate-800">{loanCategory}</strong></span>
                                                        {interestRate > 0 && (
                                                            <span>| व्याजदर: <strong className="text-slate-800">{interestRate}%</strong></span>
                                                        )}
                                                        {acc.loanDisbursementDate && (
                                                            <span>
                                                                | वितरण: <span className="text-slate-600 font-medium">{new Date(acc.loanDisbursementDate).toLocaleDateString('en-GB')}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-2">
                                                        <span>मंजूर रक्कम: <strong className="text-slate-800 font-semibold">₹{(acc.sanctionedAmount || 0).toLocaleString('en-IN')}</strong></span>
                                                        {acc.installmentAmount > 0 && (
                                                            <span>
                                                                | हप्ता: <strong className="text-emerald-700 font-semibold">₹{(acc.installmentAmount || 0).toLocaleString('en-IN')}</strong>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 sm:text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">मुद्दल शिल्लक</div>
                                                    <div className="text-base font-black text-rose-700">
                                                        ₹ {(acc.principalBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectLoanFromModal(acc);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                                        isCurrent
                                                            ? 'bg-primary text-white shadow-sm'
                                                            : 'bg-white hover:bg-primary hover:text-white text-primary border border-primary/40'
                                                    }`}
                                                >
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    <span>{isCurrent ? 'निवडलेले आहे' : 'हे कर्ज खाते निवडा'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center text-xs">
                            <span className="text-slate-600 font-medium">
                                कर्ज खाते निवडल्यावर त्याचे हप्ता व व्याज तपशील आपोआप लोड होतील.
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowMultiLoanModal(false)}
                                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-sm font-bold cursor-pointer transition-colors border border-slate-300"
                            >
                                बंद करा (Close)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoanCollectionMaster;

