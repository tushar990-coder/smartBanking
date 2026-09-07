import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { PlusCircle, Search, Save, Edit, Trash2, X, FileText, CheckSquare, Printer, Calendar, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import LoanCollectionReceiptPrint from './LoanCollectionReceiptPrint';

interface LoanAccount {
    loanAccountID: number;
    loanAccountNo: string;
    memberID: number;
    sanctionedAmount: number;
    principalBalance: number;
    interestBalance: number;
    overdueInterestBalance: number;
    installmentAmount: number;
    member?: {
        firstName: string;
        lastName: string;
    };
    loanRate?: {
        loanType: string;
        shortName?: string;
        interestRate?: number;
        interestCalculationMethod?: string;
        loanInstallmentType?: string;
    };
    interestRate?: number;
    loanDisbursementDate?: string;
    lastInstallmentPaidDate?: string;
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
    collectionDate: string;
    receiptNo: string;
    totalAmountReceived: number;
    surchargeCollected: number;
    penaltyInterestCollected: number;
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

const LoanCollectionMaster: React.FC = () => {
    const [collections, setCollections] = useState<LoanCollection[]>([]);
    const [accounts, setAccounts] = useState<LoanAccount[]>([]);
    const [ledgers, setLedgers] = useState<Ledger[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Printing state
    const [lastSavedCollectionId, setLastSavedCollectionId] = useState<number | null>(null);
    const [printingCollectionId, setPrintingCollectionId] = useState<number | null>(null);

    // View All Receipts Modal State
    const [showReceiptsModal, setShowReceiptsModal] = useState(false);
    const [editingReceiptId, setEditingReceiptId] = useState<number | null>(null);
    const [editData, setEditData] = useState<any>({});

    // Installment Schedule Modal State
    const [showInstallmentModal, setShowInstallmentModal] = useState(false);
    const [modalFilter, setModalFilter] = useState<'ALL' | 'OVERDUE' | 'PENDING' | 'PAID' | 'PARTIAL'>('ALL');
    const [isSchedulePrintView, setIsSchedulePrintView] = useState(false);

    const [formData, setFormData] = useState<Partial<LoanCollection>>({
        collectionDate: new Date().toISOString().split('T')[0],
        receiptNo: '',
        paymentMode: "Cash",
        totalAmountReceived: 0,
        surchargeCollected: 0,
        penaltyInterestCollected: 0,
        interestCollected: 0,
        principalCollected: 0,
        fees: []
    });

    const [selectedAccount, setSelectedAccount] = useState<LoanAccount | null>(null);
    const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
    const [selectedBorrowerKey, setSelectedBorrowerKey] = useState<string | null>(null);
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

    // Extract unique borrowers (Customers & Members) from active loan accounts
    const borrowerOptions = useMemo(() => {
        const map = new Map<string, any>();
        accounts.forEach((a: any) => {
            const key = a.customerID ? `C_${a.customerID}` : `M_${a.memberID}`;
            if (!map.has(key)) {
                let name = '';
                let prefix = '';
                if (a.customer) {
                    name = `${a.customer.firstName || ''} ${a.customer.middleName ? a.customer.middleName + ' ' : ''}${a.customer.lastName || ''}`.trim();
                    prefix = a.customer.cifNo ? `[${a.customer.cifNo}] ` : (a.member?.memberCode ? `[${a.member.memberCode}] ` : '');
                } else if (a.member) {
                    name = `${a.member.firstName || ''} ${a.member.middleName ? a.member.middleName + ' ' : ''}${a.member.lastName || ''}`.trim();
                    prefix = a.member.memberCode ? `[${a.member.memberCode}] ` : '';
                }
                if (!name && a.loanAccountNo) name = `खाते #${a.loanAccountNo}`;
                map.set(key, {
                    value: key,
                    label: `${prefix}${name}`.trim(),
                    customerID: a.customerID,
                    memberID: a.memberID
                });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [accounts]);
    const memberOptions = borrowerOptions;

    // Loans of selected borrower
    const borrowerLoans = useMemo(() => {
        if (!selectedBorrowerKey && !selectedMemberId) return [];
        return accounts.filter((a: any) => {
            const key = a.customerID ? `C_${a.customerID}` : `M_${a.memberID}`;
            return (selectedBorrowerKey && (key === selectedBorrowerKey || `M_${a.memberID}` === selectedBorrowerKey || `C_${a.customerID}` === selectedBorrowerKey || String(a.memberID) === selectedBorrowerKey)) ||
                   (selectedMemberId && a.memberID === selectedMemberId);
        });
    }, [accounts, selectedBorrowerKey, selectedMemberId]);
    const memberLoans = borrowerLoans;

    const bankLedgers = ledgers.filter((l: any) => 
        l.accountGroup?.groupName?.toLowerCase().includes('bank') || 
        l.accountGroup?.groupName?.includes('बँक') ||
        l.accountGroup?.groupName?.includes('शिल्लक') ||
        l.ledgerName.includes('बँक') ||
        l.ledgerName.includes('Bank')
    );

    const fetchNextReceiptNo = async (targetAccountId?: number) => {
        try {
            const url = targetAccountId 
                ? `/api/LoanCollections/next-receipt-no?loanAccountId=${targetAccountId}`
                : '/api/LoanCollections/next-receipt-no';
            const res = await axios.get(url);
            if (res.data && res.data.receiptNo) {
                setFormData(prev => ({ ...prev, receiptNo: res.data.receiptNo }));
            }
        } catch (err) {
            console.error("Failed to fetch next receipt number", err);
        }
    };

    useEffect(() => {
        fetchSanstha();
        fetchData();
        fetchAccounts();
        fetchLedgers();
        fetchNextReceiptNo();
        return () => {
            (window as any).selectedLoanMemberId = undefined;
        };
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/LoanCollections');
            setCollections(res.data);
            
            // Calculate today's totals
            const todayStr = new Date().toISOString().split('T')[0];
            let cash = 0;
            let bank = 0;
            res.data.forEach((c: any) => {
                if (c.collectionDate.split('T')[0] === todayStr) {
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
            } catch (err: any) {
                console.error("Failed to delete receipt", err);
                alert(err.response?.data?.message || "पावती डिलीट करताना त्रुटी आली.");
            }
        }
    };

    const fetchAccounts = async () => {
        try {
            const res = await axios.get('/api/LoanAccounts');
            const activeAccs = res.data.filter((a: any) => a.status === 'Active');
            setAccounts(activeAccs);

            const params = new URLSearchParams(window.location.search);
            const memberIdStr = params.get('memberId');
            const customerIdStr = params.get('customerId');
            const loanAccNo = params.get('loanAccountNo');
            if (loanAccNo) {
                const matchedAcc = activeAccs.find((a: any) => a.loanAccountNo === loanAccNo);
                if (matchedAcc) selectLoanAccountById(matchedAcc.loanAccountID);
            } else if (customerIdStr) {
                const cId = parseInt(customerIdStr, 10);
                const matchedAcc = activeAccs.find((a: any) => a.customerID === cId);
                if (matchedAcc) selectLoanAccountById(matchedAcc.loanAccountID);
            } else if (memberIdStr) {
                const mId = parseInt(memberIdStr, 10);
                const matchedAcc = activeAccs.find((a: any) => a.memberID === mId);
                if (matchedAcc) selectLoanAccountById(matchedAcc.loanAccountID);
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

    const selectLoanAccountById = async (accId: number) => {
        const acc = accounts.find(a => a.loanAccountID === accId);
        if (!acc) return;

        setSelectedAccount(acc);
        const bKey = acc.customerID ? `C_${acc.customerID}` : `M_${acc.memberID}`;
        setSelectedBorrowerKey(bKey);
        setSelectedMemberId(acc.memberID || null);
        (window as any).selectedLoanMemberId = acc.memberID;
        setFormData(p => ({ ...p, loanAccountID: acc.loanAccountID }));
        setAccountDetails(null);
        setNpaStatus(null);

        fetchNextReceiptNo(acc.loanAccountID);
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
                        loanDisbursementDate: res.data.disbursementDate || prev.loanDisbursementDate
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

    const handleMemberChange = (e: any) => {
        const val = e.target.value;
        if (!val) {
            setSelectedBorrowerKey(null);
            setSelectedMemberId(null);
            setSelectedAccount(null);
            setAccountDetails(null);
            setNpaStatus(null);
            (window as any).selectedLoanMemberId = undefined;
            setFormData(p => ({ ...p, loanAccountID: undefined }));
            return;
        }

        setSelectedBorrowerKey(val);
        const matched = borrowerOptions.find(o => o.value === val);
        if (matched?.memberID) {
            setSelectedMemberId(matched.memberID);
            (window as any).selectedLoanMemberId = matched.memberID;
        } else {
            setSelectedMemberId(null);
            (window as any).selectedLoanMemberId = undefined;
        }

        const loans = accounts.filter((a: any) => {
            const key = a.customerID ? `C_${a.customerID}` : `M_${a.memberID}`;
            return key === val || (a.memberID && `M_${a.memberID}` === val) || (a.customerID && `C_${a.customerID}` === val);
        });

        if (loans.length === 1) {
            selectLoanAccountById(loans[0].loanAccountID);
        } else {
            setSelectedAccount(null);
            setAccountDetails(null);
            setNpaStatus(null);
            setFormData(p => ({ ...p, loanAccountID: undefined }));
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
        if (acc.lastInstallmentPaidDate) {
            return acc.lastInstallmentPaidDate;
        }
        return acc.loanDisbursementDate || acc.openingDate || null;
    };

    const calculateInterest = (acc: any, dateStr: string) => {
        if (!acc) return;
        const installment = acc.installmentAmount || 0;
        // Use autoApportion to pre-fill the form with installment amount correctly allocated
        autoApportion(installment, formData.fees || [], acc, dateStr);
    };

    // Watch for collectionDate and accountDetails changes to recalculate interest and due amount
    useEffect(() => {
        if (selectedAccount) {
            const loanRate = selectedAccount.loanRate;
            const isDailyReducing = loanRate && 
                (loanRate.interestCalculationMethod?.includes("Daily Reducing") || loanRate.interestCalculationMethod?.includes("Reducing"));

            if (!isDailyReducing && accountDetails?.schedule && accountDetails.schedule.length > 0) {
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
                autoApportion(totalInstDue > 0 ? totalInstDue : (selectedAccount.installmentAmount || 0), formData.fees || [], selectedAccount);
            } else {
                calculateInterest(selectedAccount, formData.collectionDate || new Date().toISOString().split('T')[0]);
            }
        }
    }, [formData.collectionDate, accountDetails, selectedAccount]);

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
            (loanRate.interestCalculationMethod?.includes("Daily Reducing") || loanRate.interestCalculationMethod?.includes("Reducing"));

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
                const interestDue = targetInstallments.reduce((sum, s) => sum + s.interestAmount, 0);
                const principalDue = targetInstallments.reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);

                const interestCollected = Math.min(remaining, interestDue);
                remaining -= interestCollected;

                const principalCollected = Math.min(remaining, principalDue);
                remaining -= principalCollected;

                const maxPrincipal = account.principalBalance || 0;
                const actualPrincipalCol = Math.min(maxPrincipal, principalCollected + remaining);

                setFormData(p => ({
                    ...p,
                    totalAmountReceived: totalAmt,
                    penaltyInterestCollected: penaltyCollected,
                    interestCollected: interestCollected,
                    principalCollected: actualPrincipalCol,
                    surchargeCollected: 0,
                    fees: currentFees
                }));
                return;
            }
        }

        // Fallback to dynamic daily calculation if no schedule exists or for daily reducing
        const rate = account.loanRate?.interestRate || account.interestRate || 0;
        const principal = account.principalBalance || 0;
        const fromDateStr = getInterestStartDate(account);
        
        let interestDue = account.interestBalance || 0;
        if (fromDateStr) {
            const fromDate = new Date(fromDateStr);
            fromDate.setHours(0, 0, 0, 0);
            const toDate = new Date(dateStr);
            toDate.setHours(0, 0, 0, 0);
            const diffTime = toDate.getTime() - fromDate.getTime();
            const diffDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
            if (diffDays > 0) {
                interestDue += Math.round((principal * rate * diffDays) / 36500);
            }
        }
        
        const interestCollected = Math.min(remaining, interestDue);
        remaining -= interestCollected;

        const principalCollected = Math.min(remaining, principal);
        remaining -= principalCollected;
        
        const actualPrincipalCol = principalCollected + remaining; 

        setFormData(p => ({
            ...p,
            totalAmountReceived: totalAmt,
            penaltyInterestCollected: penaltyCollected,
            interestCollected: interestCollected,
            principalCollected: actualPrincipalCol,
            surchargeCollected: 0,
            fees: currentFees
        }));
    };

    const handleSplitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const val = parseFloat(value) || 0;
        
        setFormData(p => {
            const newForm = { ...p, [name]: val };
            const feesSum = (newForm.fees || []).reduce((acc, f) => acc + (f.amount || 0), 0);
            
            if (name === 'interestCollected' || name === 'penaltyInterestCollected' || name === 'surchargeCollected') {
                // Keep total constant, adjust principal
                let newPrincipal = (p.totalAmountReceived || 0) - feesSum - (newForm.interestCollected || 0) - (newForm.penaltyInterestCollected || 0) - (newForm.surchargeCollected || 0);
                
                if (newPrincipal < 0) {
                    newPrincipal = 0;
                    // If principal goes below 0, adjust total instead
                    newForm.totalAmountReceived = feesSum + (newForm.interestCollected || 0) + (newForm.penaltyInterestCollected || 0) + (newForm.surchargeCollected || 0);
                }
                newForm.principalCollected = newPrincipal;
            } else if (name === 'principalCollected') {
                // If explicitly changing principal, recalculate total
                newForm.totalAmountReceived = (newForm.principalCollected || 0) + (newForm.interestCollected || 0) + (newForm.penaltyInterestCollected || 0) + (newForm.surchargeCollected || 0) + feesSum;
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
            const res = await axios.post('/api/LoanCollections', formData);
            alert('पावती यशस्वीरित्या जतन झाली!');
            
            // Save the ID for printing
            if (res.data && res.data.loanCollectionID) {
                setLastSavedCollectionId(res.data.loanCollectionID);
            }

            // Reset form
            setFormData({
                collectionDate: new Date().toISOString().split('T')[0],
                receiptNo: '',
                paymentMode: "Cash",
                totalAmountReceived: 0,
                surchargeCollected: 0,
                penaltyInterestCollected: 0,
                interestCollected: 0,
                principalCollected: 0,
                fees: []
            });
            setSelectedBorrowerKey(null);
            setSelectedMemberId(null);
            setSelectedAccount(null);
            setAccountDetails(null);
            (window as any).selectedLoanMemberId = undefined;
            fetchData();
            fetchAccounts();
            fetchNextReceiptNo();
        } catch (err: any) {
            alert('माहिती जतन करण्यास अडचण आली: ' + (err.response?.data || err.message));
            console.error(err);
        }
    };

    const handleDirectWhatsAppShare = (c: any) => {
        if (!c) return;
        const sansthaName = sanstha?.sansthaName || 'स्मार्ट मल्टीस्टेट पतसंस्था लि.';
        const borrower = c.loanAccount?.customer || c.loanAccount?.member;
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
• व्याज जमा: ₹ ${c.interestCollected?.toLocaleString('en-IN') || '0.00'}
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

            <form onSubmit={handleSubmit}>
            <div className="flex flex-col lg:flex-row gap-2.5">
                {/* Left Sidebar - Payment Details */}
                <div className="w-full lg:w-1/4 bg-white rounded-sm shadow-xs border border-gray-300 flex flex-col overflow-hidden">
                    <div className="bg-primary text-white px-2.5 py-1 text-xs font-bold flex items-center justify-between shadow-xs border-b border-primary/20">
                        <span className="flex items-center gap-1.5"><CheckSquare size={13} /> पावती तपशील (Receipt Details)</span>
                    </div>

                    <div className="p-2 flex flex-col gap-2">
                        <div className="bg-primary/5 p-1.5 rounded-sm border border-primary/20 flex justify-between items-center text-[11px]">
                            <span className="font-bold text-gray-700">पावती क्र. (Receipt No):</span>
                            <span className="font-mono font-bold text-primary text-xs bg-white px-2 py-0.5 rounded-sm border border-primary/30 shadow-2xs">
                                {formData.receiptNo || 'Auto'}
                            </span>
                        </div>
                        
                        <div className="space-y-1.5 text-[11px]">
                            <div className="flex justify-between items-center bg-primary/10 p-1.5 rounded-sm border border-primary/30 mb-2">
                                <label className="font-bold text-primary">एकूण जमा रक्कम (Total)</label>
                                <input type="number" name="totalAmountReceived" value={formData.totalAmountReceived || ''} onChange={handleTotalAmountChange} min="0"
                                    className="w-28 border-2 border-primary px-2 py-1 font-bold focus:outline-none focus:ring-1 focus:ring-primary rounded-sm text-right bg-white text-primary" placeholder="₹0.00" />
                            </div>

                            <div className="flex justify-between items-center hover:bg-gray-50 p-1 rounded-sm transition-colors">
                                <label className="font-semibold text-gray-700">रक्कम (Principal)</label>
                                <input type="number" name="principalCollected" value={formData.principalCollected !== undefined ? formData.principalCollected : ''} onChange={handleSplitChange} min="0"
                                    className="w-24 border border-gray-300 rounded-sm px-1.5 py-0.5 h-[22px] focus:outline-none focus:border-primary bg-white text-right font-medium text-gray-800" />
                            </div>
                            <div className="flex justify-between items-center hover:bg-gray-50 p-1 rounded-sm transition-colors">
                                <label className="font-semibold text-gray-700">मेंबर व्याज (Interest)</label>
                                <input type="number" name="interestCollected" value={formData.interestCollected !== undefined ? formData.interestCollected : ''} onChange={handleSplitChange} min="0"
                                    className="w-24 border border-gray-300 rounded-sm px-1.5 py-0.5 h-[22px] focus:outline-none focus:border-primary bg-white text-right font-medium text-gray-800" />
                            </div>
                            <div className="flex justify-between items-center hover:bg-gray-50 p-1 rounded-sm transition-colors">
                                <label className="font-semibold text-gray-700">जादा व्याज (Penal Int)</label>
                                <input type="number" name="penaltyInterestCollected" value={formData.penaltyInterestCollected !== undefined ? formData.penaltyInterestCollected : ''} onChange={handleSplitChange} min="0"
                                    className="w-24 border border-gray-300 rounded-sm px-1.5 py-0.5 h-[22px] focus:outline-none focus:border-primary bg-white text-right font-medium text-gray-800" />
                            </div>
                            <div className="flex justify-between items-center hover:bg-gray-50 p-1 rounded-sm transition-colors">
                                <label className="font-semibold text-gray-700">देणे सरचार्ज (Surcharge)</label>
                                <input type="number" name="surchargeCollected" value={formData.surchargeCollected !== undefined ? formData.surchargeCollected : ''} onChange={handleSplitChange} min="0"
                                    className="w-24 border border-gray-300 rounded-sm px-1.5 py-0.5 h-[22px] focus:outline-none focus:border-primary bg-white text-right font-medium text-gray-800" />
                            </div>
     
                            {/* Dynamic Ledgers */}
                            <div className="pt-2 border-t border-gray-200 mt-2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-primary text-[11px]">इतर वसूल खाते</span>
                                    <button type="button" onClick={addFeeRow} className="text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 text-[10px] font-bold transition-colors cursor-pointer">
                                        <PlusCircle size={12} /> खाते जोडा
                                    </button>
                                </div>
                                
                                {formData.fees?.map((fee, index) => (
                                    <div key={index} className="flex gap-1 mb-1 items-center bg-gray-50 p-1 rounded-sm border border-gray-200">
                                        <select value={fee.ledgerID} onChange={(e) => handleFeeChange(index, 'ledgerID', e.target.value)}
                                            className="w-full border border-gray-300 px-1 py-0.5 focus:outline-none focus:border-primary text-[10px] rounded-sm bg-white">
                                            <option value="0">खाते निवडा...</option>
                                            {ledgers.map(l => (
                                                <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>
                                            ))}
                                        </select>
                                        <input type="number" value={fee.amount || ''} onChange={(e) => handleFeeChange(index, 'amount', e.target.value)} min="0" placeholder="रक्कम"
                                            className="w-16 border border-gray-300 px-1.5 py-0.5 focus:outline-none focus:border-primary text-[10px] rounded-sm text-right font-medium bg-white" />
                                        <button type="button" onClick={() => removeFeeRow(index)} className="text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"><Trash2 size={12}/></button>
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
                    <div className="bg-white rounded-sm shadow-xs border border-gray-300 overflow-hidden">
                        <div className="bg-primary text-white px-2.5 py-1 text-xs font-bold flex items-center justify-between shadow-xs border-b border-primary/20">
                            <span className="flex items-center gap-1.5"><FileText size={13} /> कर्ज खाते निवड व तपशील (Loan Account Details)</span>
                        </div>

                        <div className="p-2.5">
                            {/* Row 1: Date, Member, Payment Mode */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                                <div>
                                    <label className={labelClass}>दिनांक (Date)</label>
                                    <input type="date" name="collectionDate" value={formData.collectionDate} onChange={(e) => setFormData(p => ({ ...p, collectionDate: e.target.value }))} required 
                                        className={inputClass} />
                                </div>
                                
                                <div className="md:col-span-2">
                                    <label className={labelClass}>खातेदार / सभासद (Borrower / Member)</label>
                                    <SearchableSelect 
                                        options={borrowerOptions}
                                        value={selectedBorrowerKey || (selectedMemberId ? `M_${selectedMemberId}` : '')} 
                                        onChange={handleMemberChange} 
                                        placeholder="खातेदार, ग्राहक किंवा सभासद निवडा..." required />
                                </div>
                                
                                <div>
                                    <label className={labelClass}>मोड (Payment Mode)</label>
                                    <select name="paymentMode" value={formData.paymentMode} onChange={(e) => setFormData(p => ({ ...p, paymentMode: e.target.value }))}
                                        className={inputClass}>
                                        <option value="Cash">Cash (रोख)</option>
                                        <option value="Bank">Bank Transfer (बँक ट्रान्सफर)</option>
                                        <option value="Cheque">Cheque (चेक)</option>
                                        <option value="Saving Transfer">Saving Transfer (सेव्हिंग)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Row 2: Loan Type (Karj Prakar) */}
                            <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-2 items-center">
                                    <div className="md:col-span-3">
                                        <label className={`${labelClass} text-primary font-bold`}>कर्ज प्रकार व खाते (Loan Type & Account)</label>
                                        <select 
                                            value={formData.loanAccountID?.toString() || ''} 
                                            onChange={handleLoanAccountSelect}
                                            disabled={(!selectedBorrowerKey && !selectedMemberId) || borrowerLoans.length === 0}
                                            className={`${inputClass} font-bold text-xs ${(!selectedBorrowerKey && !selectedMemberId) ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-primary/5 text-primary border-primary/30 shadow-2xs'}`}
                                            required>
                                            <option value="">{selectedBorrowerKey || selectedMemberId ? (borrowerLoans.length === 0 ? "कर्ज उपलब्ध नाही" : "-- कर्ज प्रकार व खाते निवडा --") : "आधी खातेदार निवडा..."}</option>
                                            {borrowerLoans.map((a: any) => (
                                                <option key={a.loanAccountID} value={a.loanAccountID}>
                                                    {a.loanAccountNo} - {a.loanRate?.shortName || a.loanRate?.loanType || 'कर्ज'} (मंजूर: ₹{a.sanctionedAmount?.toLocaleString('en-IN') || 0} | शिल्लक: ₹{a.principalBalance?.toLocaleString('en-IN') || 0})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center mt-2 border-t pt-2 border-gray-100">
                                {formData.paymentMode === 'Bank' && (
                                    <select name="bankAccountLedgerID" value={formData.bankAccountLedgerID || ''} 
                                        onChange={(e) => {
                                            const ledgerId = parseInt(e.target.value);
                                            const selectedBank = bankLedgers.find(l => l.ledgerID === ledgerId);
                                            setFormData(p => ({ 
                                                ...p, 
                                                bankAccountLedgerID: ledgerId || undefined,
                                                bankName: selectedBank ? selectedBank.ledgerName : undefined
                                            }));
                                        }}
                                        className={inputClass} required>
                                        <option value="">-- बँक खाते निवडा (Select Bank A/c) --</option>
                                        {bankLedgers.map(l => (
                                            <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>
                                        ))}
                                    </select>
                                )}
                                {formData.paymentMode === 'Cheque' && (
                                    <>
                                        <select name="bankAccountLedgerID" value={formData.bankAccountLedgerID || ''} 
                                            onChange={(e) => {
                                                const ledgerId = parseInt(e.target.value);
                                                const selectedBank = bankLedgers.find(l => l.ledgerID === ledgerId);
                                                setFormData(p => ({ 
                                                    ...p, 
                                                    bankAccountLedgerID: ledgerId || undefined,
                                                    bankName: selectedBank ? selectedBank.ledgerName : undefined
                                                }));
                                            }}
                                            className={inputClass} required>
                                            <option value="">-- बँक खाते निवडा (Select Bank A/c) --</option>
                                            {bankLedgers.map(l => (
                                                <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>
                                            ))}
                                        </select>
                                        <input type="text" value={formData.chequeNo || ''} onChange={(e) => setFormData(p => ({ ...p, chequeNo: e.target.value }))} placeholder="चेक नंबर (Cheque No)" className={inputClass} required />
                                    </>
                                )}
                                {formData.paymentMode === 'Saving Transfer' && (
                                    <input type="text" value={formData.transferFromSavingAccountNo || ''} onChange={(e) => setFormData(p => ({ ...p, transferFromSavingAccountNo: e.target.value }))} placeholder="Saving Account No" className={inputClass} />
                                )}
                                
                                <label className={labelClass + " whitespace-nowrap !mb-0"}>तपशील</label>
                                <input type="text" value={formData.remarks || ''} onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))} className={inputClass} placeholder="अधिक माहिती..." />
                            </div>

                            {/* OTS & Interest Waiver Section */}
                            <div className="bg-amber-50/80 p-2 rounded-sm border border-amber-300 mt-2 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isOTS || false}
                                            onChange={(e) => setFormData(p => ({ ...p, isOTS: e.target.checked }))}
                                            className="w-4 h-4 text-amber-600 rounded-sm focus:ring-amber-500 cursor-pointer"
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
                                                className="w-full text-xs border border-amber-300 rounded-sm px-2 py-1 bg-white font-bold text-amber-900 focus:outline-none focus:border-amber-600"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-amber-900 mb-1">माफ करावयाचे दंड व्याज (Penalty Waived ₹)</label>
                                            <input
                                                type="number"
                                                value={formData.penaltyWaived || ''}
                                                onChange={(e) => setFormData(p => ({ ...p, penaltyWaived: parseFloat(e.target.value) || 0 }))}
                                                className="w-full text-xs border border-amber-300 rounded-sm px-2 py-1 bg-white font-bold text-amber-900 focus:outline-none focus:border-amber-600"
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
                                                className="w-full text-xs border border-amber-300 rounded-sm px-2 py-1 bg-white font-bold text-amber-900 focus:outline-none focus:border-amber-600"
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
                                    <th className="p-1 border-r border-gray-300">कर्ज उचल रक्कम</th>
                                    <th className="p-1 border-r border-gray-300 text-primary font-bold">हप्त्याची रक्कम</th>
                                    <th className="p-1 border-r border-gray-300">व्याज दर (%)</th>
                                    <th className="p-1 border-r border-gray-300">येणे बाकी</th>
                                    <th className="p-1 border-r border-gray-300">वसुलपात्र</th>
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
                                    <th className="p-1 bg-amber-100 text-amber-900 font-bold">एकूण वसुलपात्र</th>
                                </tr>
                            </thead>
                            <tbody>
                                 {selectedAccount ? (
                                     (() => {
                                         const loanRate = selectedAccount.loanRate;
                                         const isDailyReducing = loanRate && 
                                             (loanRate.interestCalculationMethod?.includes("Daily Reducing") || loanRate.interestCalculationMethod?.includes("Reducing"));

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
                                                 const fromDate = parseDateSafe(fromDateStr);
                                                 fromDate.setHours(0, 0, 0, 0);
                                                 const toDate = parseDateSafe(formData.collectionDate || new Date());
                                                 toDate.setHours(0, 0, 0, 0);
                                                 const diffDays = Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)));
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
                                             const fromDate = parseDateSafe(fromDateStrGrid);
                                             fromDate.setHours(0, 0, 0, 0);
                                             const toDate = parseDateSafe(formData.collectionDate || new Date());
                                             toDate.setHours(0, 0, 0, 0);
                                             days = Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)));
                                         }

                                         // Calculate Remaining Loan Amount (शिल्लक कर्ज रक्कम)
                                         const shillakKarjRakkam = Math.max(0, yeneBaki - (formData.principalCollected || 0));

                                         // Calculate Total Recoverable (एकूण वसुलपात्र)
                                         const ekunVasulpatra = vasulpatra + vyaj + yeneVyaj + dandVyaj + surcharge + vasuliFee;

                                         return (
                                             <tr className="border-b border-gray-200 hover:bg-gray-50">
                                                 <td className="p-1.5 border-r border-gray-200 font-semibold">{selectedAccount.loanRate?.shortName || selectedAccount.loanRate?.loanType || 'N/A'}</td>
                                                 <td className="p-1.5 border-r border-gray-200">{disbursementDate ? formatDateSafe(disbursementDate) : ''}</td>
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
                                                 <td className="p-1.5 border-r border-gray-200 font-mono font-semibold">{days}</td>
                                                 <td className="p-1.5 border-r border-gray-200 font-mono font-bold text-primary">{shillakKarjRakkam.toFixed(2)}</td>
                                                 <td className="p-1.5 font-mono font-bold bg-amber-100 text-amber-900 text-xs">{ekunVasulpatra.toFixed(2)}</td>
                                             </tr>
                                         );
                                     })()
                                 ) : (
                                     <tr>
                                         <td colSpan={18} className="p-8 text-gray-400 italic">कृपया खाते निवडा (Select Account)</td>
                                     </tr>
                                 )}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom Area - Actions & Summary */}
                    <div className="flex flex-col md:flex-row gap-2.5">
                        {/* Actions */}
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
                                    interestCollected: 0,
                                    principalCollected: 0,
                                    fees: []
                                });
                                setSelectedMemberId(null);
                                setSelectedAccount(null);
                                setAccountDetails(null);
                                (window as any).selectedLoanMemberId = undefined;
                                setLastSavedCollectionId(null);
                                fetchNextReceiptNo();
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
                                                        {c.loanAccount?.loanAccountNo} {c.loanAccount?.customer?.cifNo ? `| CIF: ${c.loanAccount.customer.cifNo}` : (c.loanAccount?.member?.memberCode ? `| ${c.loanAccount.member.memberCode}` : '')}
                                                    </span>
                                                </td>
                                                <td className="p-1 border-r text-right font-bold text-green-700">₹{c.totalAmountReceived.toFixed(2)}</td>
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
        </div>
    );
};

export default LoanCollectionMaster;

