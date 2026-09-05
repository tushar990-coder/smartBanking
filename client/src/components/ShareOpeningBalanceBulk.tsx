import React, { useState, useEffect } from 'react';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';
import { 
  Coins, 
  Plus, 
  PlusCircle, 
  Trash2, 
  Save, 
  RotateCcw, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Users, 
  Download, 
  X, 
  Layers,
  Calculator,
  List,
  Edit3
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Member extends MemberOption {}

interface ShareScheme {
  shareSchemeId: number;
  schemeCode: string;
  schemeName: string;
  memberType: string;
  shareFaceValue: number;
  minSharesCount: number;
  maxSharesCount: number;
  dividendRate: number;
  isActive: boolean;
  shareCapitalLedgerID?: number | null;
  dividendPayableLedgerID?: number | null;
}

interface GridRow {
  id: string;
  memberId: number | '';
  memberName: string;
  memberCode: string;
  cifNo: string;
  legacyMemberNo: string;
  shareSchemeId: number | '';
  shareQuantity: number | '';
  faceValue: number;
  totalAmount: number;
  fromShareNo: number | '';
  toShareNo: number | '';
  certificateNo: string;
  dividendPayable: number | '';
  certificateId?: number;
  isExistingRecord?: boolean;
}

interface ShareOpeningBalanceBulkProps {
  onSwitchToSingle?: () => void;
}

const ShareOpeningBalanceBulk: React.FC<ShareOpeningBalanceBulkProps> = ({ onSwitchToSingle }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [schemes, setSchemes] = useState<ShareScheme[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [existingBalances, setExistingBalances] = useState<any[]>([]);
  
  // Header / Global Batch Settings
  const [openingDate, setOpeningDate] = useState<string>(new Date().getFullYear() + '-03-31');
  const [defaultSchemeId, setDefaultSchemeId] = useState<string>('');
  const [defaultLedgerId, setDefaultLedgerId] = useState<string>('');
  const [startCertNo, setStartCertNo] = useState<string>('SC0001');
  const [startShareNo, setStartShareNo] = useState<number>(1);
  
  // Grid Data (Default 10 empty rows)
  const [rows, setRows] = useState<GridRow[]>([]);
  
  // UI states
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";
  const gridInputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-1.5 py-0.5 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium h-[26px]";

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Generate blank rows helper
  const createBlankRow = (): GridRow => ({
    id: Math.random().toString(36).substring(2, 9),
    memberId: '',
    memberName: '',
    memberCode: '',
    cifNo: '',
    legacyMemberNo: '',
    shareSchemeId: defaultSchemeId ? parseInt(defaultSchemeId) : (schemes.length > 0 ? schemes[0].shareSchemeId : ''),
    shareQuantity: '',
    faceValue: schemes.length > 0 ? (schemes[0].shareFaceValue || 100) : 100,
    totalAmount: 0,
    fromShareNo: '',
    toShareNo: '',
    certificateNo: '',
    dividendPayable: '',
    isExistingRecord: false
  });

  // Initial Load
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        fetchMembers(),
        fetchSchemes(),
        fetchLedgers(),
        fetchBalances(),
        fetchNextShareConfig()
      ]);
    } catch (err) {
      console.error("Initial load error", err);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/Members', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch members', error);
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await fetch('/api/ShareAccounts/OpeningBalance', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setExistingBalances(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch existing balances', error);
    }
  };

  const fetchSchemes = async () => {
    try {
      const res = await fetch('/api/ShareSchemes', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const activeSchemes = Array.isArray(data) ? data.filter((s: ShareScheme) => s.isActive) : [];
        setSchemes(activeSchemes);
        if (activeSchemes.length > 0 && !defaultSchemeId) {
          setDefaultSchemeId(activeSchemes[0].shareSchemeId.toString());
        }
      }
    } catch (error) {
      console.error('Failed to fetch share schemes', error);
    }
  };

  const fetchLedgers = async () => {
    try {
      const res = await fetch('/api/Ledgers', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLedgers(Array.isArray(data) ? data : []);
        // Auto select share capital ledger if available
        const shareCapital = data.find((l: any) => 
          l.ledgerName?.toLowerCase().includes('share capital') || 
          l.ledgerName?.includes('भाग भांडवल') || 
          l.ledgerName?.includes('शेअर भांडवल')
        );
        if (shareCapital) {
          setDefaultLedgerId(shareCapital.ledgerID.toString());
        }
      }
    } catch (error) {
      console.error('Failed to fetch ledgers', error);
    }
  };

  const fetchNextShareConfig = async () => {
    try {
      const res = await fetch('/api/ShareAccounts/NextShareConfig', { headers: getAuthHeaders() });
      let nextCert = 'CERT-0001';
      let nextFromShare = 1;

      if (res.ok) {
        const data = await res.json();
        if (data.nextCertificateNo) nextCert = data.nextCertificateNo;
        if (data.nextFromShareNo) nextFromShare = parseInt(data.nextFromShareNo, 10);
      }

      setStartCertNo(nextCert);
      setStartShareNo(nextFromShare);

      // Initialize initial 10 rows if empty
      setRows(prev => {
        if (prev.length > 0) return prev;
        return Array.from({ length: 10 }, () => createBlankRow());
      });
    } catch (err) {
      console.error('Error fetching share configs', err);
      if (rows.length === 0) {
        setRows(Array.from({ length: 10 }, () => createBlankRow()));
      }
    }
  };

  // Load all existing saved balances into the grid for easy viewing & editing
  const handleLoadAllExisting = () => {
    if (existingBalances.length === 0) {
      setMessage('डेटाबेसमध्ये कोणतीही आधीची शिल्लक नोंद सापडली नाही.');
      setMessageType('error');
      return;
    }

    const loadedRows: GridRow[] = existingBalances.map(b => {
      const m = members.find(mem => mem.memberID === b.memberId);
      const qty = b.shareQuantity || 0;
      const fv = b.faceValue || 100;
      return {
        id: Math.random().toString(36).substring(2, 9),
        memberId: b.memberId,
        memberName: m ? `${m.firstName || ''} ${m.lastName || ''}`.trim() : (b.memberName || ''),
        memberCode: m ? (m.memberCode || '') : '',
        cifNo: m ? (m.cifNo || '') : '',
        legacyMemberNo: m ? (m.legacyMemberNo || '') : '',
        shareSchemeId: b.shareSchemeId || (defaultSchemeId ? parseInt(defaultSchemeId) : ''),
        shareQuantity: qty,
        faceValue: fv,
        totalAmount: b.shareAmount || (qty * fv),
        fromShareNo: b.fromShareNo || '',
        toShareNo: b.toShareNo || (b.fromShareNo && qty > 0 ? b.fromShareNo + qty - 1 : ''),
        certificateNo: b.certificateNo || '',
        dividendPayable: b.dividendPayable || 0,
        certificateId: b.certificateId,
        isExistingRecord: true
      };
    });

    setRows(loadedRows);

    // Auto set startShareNo for subsequent new rows
    if (loadedRows.length > 0) {
      const maxTo = Math.max(...loadedRows.map(r => typeof r.toShareNo === 'number' ? r.toShareNo : parseInt(r.toShareNo || '0', 10)));
      if (maxTo > 0) {
        setStartShareNo(maxTo + 1);
      }
    }

    setMessage(`एकूण ${loadedRows.length} आधीच्या सेव्ह केलेल्या नोंदी ग्रिडमध्ये लोड केल्या आहेत. तुम्ही आवश्यक ते बदल करून सेव्ह करू शकता.`);
    setMessageType('success');
  };

  // Add more rows
  const handleAddRows = (count: number = 5) => {
    setRows(prev => [
      ...prev,
      ...Array.from({ length: count }, () => createBlankRow())
    ]);
  };

  // Remove empty rows
  const handleRemoveEmptyRows = () => {
    const filtered = rows.filter(r => r.memberId !== '' || r.shareQuantity !== '');
    if (filtered.length === 0) {
      setRows(Array.from({ length: 5 }, () => createBlankRow()));
    } else {
      setRows(filtered);
    }
    setMessage('सर्व रिकाम्या ओळी काढून टाकल्या.');
    setMessageType('success');
  };

  // Delete single row
  const handleDeleteRow = (id: string) => {
    setRows(prev => {
      const updated = prev.filter(r => r.id !== id);
      return updated.length > 0 ? updated : [createBlankRow()];
    });
  };

  // Update single row field
  const handleRowChange = (id: string, field: keyof GridRow, value: any) => {
    setRows(prev => {
      // Find previous non-empty row's toShareNo to auto-suggest fromShareNo
      const rowIndex = prev.findIndex(r => r.id === id);
      let prevToShare = 0;
      for (let i = rowIndex - 1; i >= 0; i--) {
        const pRow = prev[i];
        const pTo = typeof pRow.toShareNo === 'number' ? pRow.toShareNo : parseInt(pRow.toShareNo || '0', 10);
        if (!isNaN(pTo) && pTo > 0) {
          prevToShare = pTo;
          break;
        }
      }

      return prev.map(row => {
        if (row.id !== id) return row;

        const updated = { ...row, [field]: value };
        const fv = typeof updated.faceValue === 'number' ? updated.faceValue : parseFloat(updated.faceValue || '100');
        const safeFv = (isNaN(fv) || fv <= 0) ? 100 : fv;

        if (field === 'memberId') {
          const selMember = members.find(m => m.memberID === value);
          if (selMember) {
            updated.memberName = `${selMember.firstName || ''} ${selMember.lastName || ''}`.trim();
            updated.memberCode = selMember.memberCode || '';
            updated.cifNo = selMember.cifNo || '';
            updated.legacyMemberNo = selMember.legacyMemberNo ? String(selMember.legacyMemberNo).trim() : '';

            // 🔍 Check if member already has an existing opening balance
            const existing = existingBalances.find(b => b.memberId === value);
            if (existing) {
              updated.shareQuantity = existing.shareQuantity || '';
              updated.faceValue = existing.faceValue || 100;
              updated.totalAmount = existing.shareAmount || ((existing.shareQuantity || 0) * (existing.faceValue || 100));
              updated.fromShareNo = existing.fromShareNo || '';
              updated.toShareNo = existing.toShareNo || '';
              updated.certificateNo = existing.certificateNo || '';
              updated.dividendPayable = existing.dividendPayable || 0;
              updated.certificateId = existing.certificateId;
              updated.isExistingRecord = true;
            } else {
              updated.certificateId = undefined;
              updated.isExistingRecord = false;
              if (!updated.fromShareNo) {
                updated.fromShareNo = prevToShare > 0 ? prevToShare + 1 : startShareNo;
              }
            }
          } else {
            updated.memberName = '';
            updated.memberCode = '';
            updated.cifNo = '';
            updated.legacyMemberNo = '';
            updated.certificateId = undefined;
            updated.isExistingRecord = false;
          }
        }

        if (field === 'shareSchemeId') {
          const selScheme = schemes.find(s => s.shareSchemeId === value);
          if (selScheme) {
            updated.faceValue = selScheme.shareFaceValue || 100;
          }
        }

        // 1. Share Quantity Change -> Auto-calculate Total Amount and ToShareNo
        if (field === 'shareQuantity') {
          const qty = typeof value === 'number' ? value : parseFloat(value || '0');
          if (!isNaN(qty) && qty > 0) {
            updated.totalAmount = qty * safeFv;
            const fromS = typeof updated.fromShareNo === 'number' ? updated.fromShareNo : parseInt(updated.fromShareNo || '0', 10);
            const effectiveFrom = (!isNaN(fromS) && fromS > 0) ? fromS : (prevToShare > 0 ? prevToShare + 1 : startShareNo);
            updated.fromShareNo = effectiveFrom;
            updated.toShareNo = effectiveFrom + Math.floor(qty) - 1;
          } else {
            updated.totalAmount = 0;
            updated.toShareNo = '';
          }
        }

        // 2. Total Amount Change -> Auto-calculate Share Quantity and ToShareNo (Bidirectional)
        if (field === 'totalAmount') {
          const amt = typeof value === 'number' ? value : parseFloat(value || '0');
          if (!isNaN(amt) && amt > 0) {
            const calculatedQty = Math.floor(amt / safeFv);
            updated.shareQuantity = calculatedQty > 0 ? calculatedQty : '';
            updated.totalAmount = amt;
            const fromS = typeof updated.fromShareNo === 'number' ? updated.fromShareNo : parseInt(updated.fromShareNo || '0', 10);
            const effectiveFrom = (!isNaN(fromS) && fromS > 0) ? fromS : (prevToShare > 0 ? prevToShare + 1 : startShareNo);
            updated.fromShareNo = effectiveFrom;
            updated.toShareNo = calculatedQty > 0 ? (effectiveFrom + calculatedQty - 1) : '';
          } else {
            updated.shareQuantity = '';
            updated.totalAmount = 0;
            updated.toShareNo = '';
          }
        }

        // 3. FromShareNo Change -> Auto-calculate ToShareNo
        if (field === 'fromShareNo') {
          const fromS = typeof value === 'number' ? value : parseInt(value || '0', 10);
          const qty = typeof updated.shareQuantity === 'number' ? updated.shareQuantity : parseInt(updated.shareQuantity || '0', 10);
          if (!isNaN(fromS) && fromS > 0 && !isNaN(qty) && qty > 0) {
            updated.toShareNo = fromS + qty - 1;
          }
        }

        // 4. ToShareNo Change -> Auto-calculate Share Quantity and Total Amount
        if (field === 'toShareNo') {
          const toS = typeof value === 'number' ? value : parseInt(value || '0', 10);
          const fromS = typeof updated.fromShareNo === 'number' ? updated.fromShareNo : parseInt(updated.fromShareNo || '0', 10);
          if (!isNaN(fromS) && fromS > 0 && !isNaN(toS) && toS >= fromS) {
            const calculatedQty = toS - fromS + 1;
            updated.shareQuantity = calculatedQty;
            updated.totalAmount = calculatedQty * safeFv;
          }
        }

        // 5. FaceValue Change -> Auto-update Total Amount
        if (field === 'faceValue') {
          const qty = typeof updated.shareQuantity === 'number' ? updated.shareQuantity : parseFloat(updated.shareQuantity || '0');
          if (!isNaN(qty) && qty > 0) {
            updated.totalAmount = qty * safeFv;
          }
        }

        // 6. ⚡ Auto-generate Certificate Number in Real-Time if blank
        const hasMemberOrShares = updated.memberId || (typeof updated.shareQuantity === 'number' ? updated.shareQuantity > 0 : parseInt(updated.shareQuantity || '0', 10) > 0);
        if (!updated.certificateNo && hasMemberOrShares && !updated.isExistingRecord) {
          const certPrefixMatch = startCertNo.match(/^(.*?)(\d+)$/);
          let prefix = 'CERT-';
          let baseNum = 1;
          let padLen = 4;

          if (certPrefixMatch) {
            prefix = certPrefixMatch[1];
            baseNum = parseInt(certPrefixMatch[2], 10);
            padLen = certPrefixMatch[2].length;
          }

          let maxCertNum = baseNum - 1;
          for (let i = 0; i < rowIndex; i++) {
            const pCert = prev[i]?.certificateNo;
            if (pCert) {
              const m = pCert.match(/^(.*?)(\d+)$/);
              if (m) {
                const n = parseInt(m[2], 10);
                if (n > maxCertNum) maxCertNum = n;
              }
            }
          }
          updated.certificateNo = `${prefix}${String(maxCertNum + 1).padStart(padLen, '0')}`;
        }

        return updated;
      });
    });
  };

  // Auto sequence calculation across all valid rows
  const handleAutoSequenceAll = () => {
    // 💡 Determine start share number:
    // If the first valid row in the grid has a fromShareNo (e.g. 1), use that as sequence start!
    const firstFilled = rows.find(r => r.memberId !== '' && (typeof r.shareQuantity === 'number' ? r.shareQuantity > 0 : parseInt(r.shareQuantity || '0', 10) > 0));
    let currentFromShare = startShareNo;
    if (firstFilled) {
      const fFrom = typeof firstFilled.fromShareNo === 'number' ? firstFilled.fromShareNo : parseInt(firstFilled.fromShareNo || '0', 10);
      if (!isNaN(fFrom) && fFrom > 0) {
        currentFromShare = fFrom;
      }
    }
    
    let certPrefix = 'CERT-';
    let certNum = 1;
    let certPadding = 4;

    if (firstFilled && firstFilled.certificateNo) {
      const firstCertMatch = firstFilled.certificateNo.match(/^(.*?)(\d+)$/);
      if (firstCertMatch) {
        certPrefix = firstCertMatch[1];
        certNum = parseInt(firstCertMatch[2], 10);
        certPadding = firstCertMatch[2].length;
      }
    } else {
      const certPrefixMatch = startCertNo.match(/^(.*?)(\d+)$/);
      if (certPrefixMatch) {
        certPrefix = certPrefixMatch[1];
        certNum = parseInt(certPrefixMatch[2], 10);
        certPadding = certPrefixMatch[2].length;
      } else {
        const justNum = parseInt(startCertNo.replace(/\D/g, ''), 10);
        if (!isNaN(justNum)) certNum = justNum;
      }
    }

    let sequencedCount = 0;
    let finalEndShare = currentFromShare - 1;

    setRows(prev => prev.map(row => {
      const qty = typeof row.shareQuantity === 'number' ? row.shareQuantity : parseInt(row.shareQuantity || '0', 10);
      
      if (!row.memberId || isNaN(qty) || qty <= 0) {
        return row;
      }

      const rowFrom = currentFromShare;
      const rowTo = currentFromShare + qty - 1;
      const rowCert = `${certPrefix}${String(certNum).padStart(certPadding, '0')}`;

      currentFromShare = rowTo + 1;
      finalEndShare = rowTo;
      certNum++;
      sequencedCount++;

      return {
        ...row,
        fromShareNo: rowFrom,
        toShareNo: rowTo,
        certificateNo: rowCert,
        totalAmount: qty * (row.faceValue || 100)
      };
    }));

    setStartShareNo(currentFromShare);
    setMessage(`एकूण ${sequencedCount} ओळींचा शेअर क्रमांक आणि दाखला क्रमांक सलग आपोआप (शेवटचा शेअर क्र.: ${finalEndShare}) अचूक क्रमाने सेट केला!`);
    setMessageType('success');
  };

  // Calculate Batch Summary
  const validRows = rows.filter(r => r.memberId !== '' && (typeof r.shareQuantity === 'number' ? r.shareQuantity > 0 : parseInt(r.shareQuantity || '0', 10) > 0));
  const totalBatchShares = validRows.reduce((sum, r) => sum + (typeof r.shareQuantity === 'number' ? r.shareQuantity : parseInt(r.shareQuantity || '0', 10)), 0);
  const totalBatchAmount = validRows.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const totalBatchDividend = validRows.reduce((sum, r) => sum + (typeof r.dividendPayable === 'number' ? r.dividendPayable : parseFloat(r.dividendPayable || '0') || 0), 0);
  const existingCount = validRows.filter(r => r.isExistingRecord).length;

  // Check if any rows have overlapping share number ranges
  const overlappingRowIds = React.useMemo(() => {
    const ids = new Set<string>();
    let prevTo = 0;
    rows.forEach((r) => {
      if (!r.memberId) return;
      const fromS = typeof r.fromShareNo === 'number' ? r.fromShareNo : parseInt(r.fromShareNo || '0', 10);
      const toS = typeof r.toShareNo === 'number' ? r.toShareNo : parseInt(r.toShareNo || '0', 10);
      if (!isNaN(fromS) && fromS > 0) {
        if (prevTo > 0 && fromS <= prevTo) {
          ids.add(r.id);
        }
        if (!isNaN(toS) && toS >= fromS) {
          prevTo = toS;
        }
      }
    });
    return ids;
  }, [rows]);

  // Submit Bulk Batch
  const handleSaveBatch = async () => {
    // 🛡️ Mandatory Capital Ledger Validation
    if (!defaultLedgerId) {
      const errMsg = 'कृपया शेअर भांडवल लेजर (Capital Ledger) निवडा. लेजर निवडल्याशिवाय शेअर ओपनिंग बॅलन्स सेव्ह करता येत नाही.';
      setMessage(errMsg);
      setMessageType('error');
      alert(errMsg);
      return;
    }

    if (validRows.length === 0) {
      setMessage('कृपया सेव्ह करण्यासाठी किमान एका ओळीत वैध सभासद आणि शेअर संख्या भरा.');
      setMessageType('error');
      return;
    }

    if (!window.confirm(`तुम्हाला एकूण ${validRows.length} सभासदांचे शेअर ओपनिंग बॅलन्स (${existingCount > 0 ? `${existingCount} संपादन / ` : ''}एकूण शेअर्स: ${totalBatchShares}, एकूण रक्कम: ₹${totalBatchAmount.toLocaleString('en-IN')}) सेव्ह करायचे आहेत का?`)) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const payloadRecords = validRows.map(r => {
        const m = members.find(mem => mem.memberID === r.memberId || (mem as any).customerID === r.memberId);
        return {
          memberId: Number(r.memberId),
          customerId: (m as any)?.customerID || (m as any)?.id || null,
          certificateId: r.certificateId || null,
          shareSchemeId: r.shareSchemeId ? Number(r.shareSchemeId) : (defaultSchemeId ? Number(defaultSchemeId) : null),
          legacyMemberNo: r.legacyMemberNo || null,
          openingDate: openingDate,
          shareQuantity: Number(r.shareQuantity),
          faceValue: Number(r.faceValue || 100),
          dividendPayable: Number(r.dividendPayable || 0),
          dividendPayableLedgerId: null,
          fromShareNo: Number(r.fromShareNo || 0),
          toShareNo: Number(r.toShareNo || 0),
          certificateNo: r.certificateNo || `SC${r.memberId}`,
          ledgerId: defaultLedgerId ? Number(defaultLedgerId) : null
        };
      });

      const res = await fetch('/api/ShareAccounts/BulkOpeningBalance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          records: payloadRecords,
          defaultLedgerId: defaultLedgerId ? Number(defaultLedgerId) : null
        })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message || `एकूण ${validRows.length} नोंदी यशस्वीरित्या सेव्ह झाल्या!`);
        setMessageType('success');
        alert(data.message || `एकूण ${validRows.length} नोंदी यशस्वीरित्या सेव्ह झाल्या!`);
        
        await Promise.all([fetchBalances(), fetchNextShareConfig()]);
        setRows(Array.from({ length: 10 }, () => createBlankRow()));
      } else {
        setMessage(data.message || 'बल्क सेव्ह करताना त्रुटी आली.');
        setMessageType('error');
        alert(data.message || 'बल्क सेव्ह करताना त्रुटी आली.');
      }
    } catch (err: any) {
      console.error(err);
      setMessage('सर्व्हर किंवा नेटवर्क त्रुटी: ' + err.message);
      setMessageType('error');
    }
    setLoading(false);
  };

  // Handle Excel Pasting
  const handleApplyPastedData = () => {
    if (!pastedText.trim()) return;

    const lines = pastedText.trim().split('\n');
    const newRows: GridRow[] = [];

    lines.forEach(line => {
      const cols = line.split('\t').map(c => c.trim());
      if (cols.length === 0 || !cols[0]) return;

      const searchKey = cols[0].toLowerCase();
      const matchedMember = members.find(m => 
        (m.memberCode && m.memberCode.toLowerCase() === searchKey) ||
        (m.cifNo && m.cifNo.toLowerCase() === searchKey) ||
        (m.legacyMemberNo && m.legacyMemberNo.toLowerCase() === searchKey) ||
        (m.memberID && m.memberID.toString() === searchKey) ||
        (`${m.firstName} ${m.lastName}`.toLowerCase().includes(searchKey))
      );

      const qty = cols[1] ? parseInt(cols[1].replace(/\D/g, ''), 10) : 10;
      const fv = cols[2] ? parseFloat(cols[2].replace(/[^\d.]/g, '')) : 100;
      const fromNo = cols[3] ? parseInt(cols[3].replace(/\D/g, ''), 10) : '';
      const toNo = cols[4] ? parseInt(cols[4].replace(/\D/g, ''), 10) : '';
      const certNo = cols[5] || '';
      const divPay = cols[6] ? parseFloat(cols[6].replace(/[^\d.]/g, '')) : '';

      const mId = matchedMember ? matchedMember.memberID : '';
      const existing = mId ? existingBalances.find(b => b.memberId === mId) : null;

      newRows.push({
        id: Math.random().toString(36).substring(2, 9),
        memberId: mId,
        memberName: matchedMember ? `${matchedMember.firstName || ''} ${matchedMember.lastName || ''}`.trim() : (cols[0] || ''),
        memberCode: matchedMember ? (matchedMember.memberCode || '') : '',
        cifNo: matchedMember ? (matchedMember.cifNo || '') : '',
        legacyMemberNo: matchedMember ? (matchedMember.legacyMemberNo || '') : '',
        shareSchemeId: defaultSchemeId ? parseInt(defaultSchemeId) : (schemes.length > 0 ? schemes[0].shareSchemeId : ''),
        shareQuantity: isNaN(qty) ? '' : qty,
        faceValue: isNaN(fv) ? 100 : fv,
        totalAmount: (!isNaN(qty) && !isNaN(fv)) ? qty * fv : 0,
        fromShareNo: fromNo,
        toShareNo: toNo,
        certificateNo: certNo,
        dividendPayable: divPay,
        certificateId: existing ? existing.certificateId : undefined,
        isExistingRecord: !!existing
      });
    });

    if (newRows.length > 0) {
      setRows(newRows);
      setShowPasteModal(false);
      setPastedText('');
      setMessage(`एक्सेलवरून एकूण ${newRows.length} ओळी यशस्वीरित्या ग्रिडमध्ये लोड केल्या!`);
      setMessageType('success');
    }
  };

  // Download Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "सभासद कोड / CIF / नाव (MemberCode/CIF)": "MEM0001",
        "शेअर संख्या (ShareQuantity)": 10,
        "दर्शनी मूल्य (FaceValue)": 100,
        "शेअर क्र. पासून (FromShareNo)": 1,
        "शेअर क्र. पर्यंत (ToShareNo)": 10,
        "प्रमाणपत्र क्र. (CertificateNo)": "SC0001",
        "लाभांश येणे (DividendPayable)": 0
      },
      {
        "सभासद कोड / CIF / नाव (MemberCode/CIF)": "MEM0002",
        "शेअर संख्या (ShareQuantity)": 20,
        "दर्शनी मूल्य (FaceValue)": 100,
        "शेअर क्र. पासून (FromShareNo)": 11,
        "शेअर क्र. पर्यंत (ToShareNo)": 30,
        "प्रमाणपत्र क्र. (CertificateNo)": "SC0002",
        "लाभांश येणे (DividendPayable)": 0
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Share_Bulk_Template");
    XLSX.writeFile(wb, "Share_Bulk_Opening_Template.xlsx");
  };

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Coins size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>शेअर ओपनिंग बॅलन्स स्थलांतर - बल्क ग्रिड</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Share Bulk Grid Migration)</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">एकाच वेळी अनेक सभासदांचे शेअर्स एक्सेलसारखे भरून किंवा आधीच्या नोंदी संपादन करून सेव्ह करा</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Load All Existing Records Button */}
          <button
            type="button"
            onClick={handleLoadAllExisting}
            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नोंदवलेल्या सर्व शिल्लक नोंदी ग्रिडमध्ये लोड करा व एडिट करा"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-700" />
            <span>📋 नोंदवलेल्या नोंदी ग्रिडमध्ये आणा ({existingBalances.length})</span>
          </button>

          {onSwitchToSingle && (
            <button
              type="button"
              onClick={onSwitchToSingle}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="मॅन्युअल एक-एक फॉर्मवर जा"
            >
              <List className="w-3.5 h-3.5" />
              <span>📝 मॅन्युअल फॉर्म</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="एक्सेलवरून डेटा पेस्ट करा"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel Paste</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नमुना एक्सेल फॉरमॅट डाऊनलोड करा"
          >
            <Download className="w-3.5 h-3.5" />
            <span>एक्सेल फॉरमॅट</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">वैध सभासद नोंदी</div>
            <div className="text-sm font-black text-gray-900 font-mono">
              {validRows.length} {existingCount > 0 && <span className="text-[10px] text-amber-700 font-sans font-bold">({existingCount} आधीच्या)</span>}
            </div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण शेअर्स संख्या</div>
            <div className="text-sm font-black text-emerald-700 font-mono">{totalBatchShares.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-700 border border-blue-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण शेअर रक्कम</div>
            <div className="text-sm font-black text-blue-700 font-mono">₹{totalBatchAmount.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">येणे लाभांश</div>
            <div className="text-sm font-black text-amber-700 font-mono">₹{totalBatchDividend.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* Global Batch Controls Bar */}
      <div className="bg-white p-3 rounded-sm border border-slate-200 shadow-xs mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          <div>
            <label className={labelClass}>आरंभी दिनांक (Opening Date) *</label>
            <input
              type="date"
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>डीफॉल्ट शेअर योजना (Default Scheme)</label>
            <select
              value={defaultSchemeId}
              onChange={(e) => setDefaultSchemeId(e.target.value)}
              className={inputClass}
            >
              {schemes.map(s => (
                <option key={s.shareSchemeId} value={s.shareSchemeId}>
                  {s.schemeName} (₹{s.shareFaceValue})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`${labelClass} flex items-center gap-1`}>
              <span>शेअर भांडवल लेजर (Capital Ledger)</span>
              <span className="text-red-500 font-black">*</span>
            </label>
            <select
              value={defaultLedgerId}
              onChange={(e) => setDefaultLedgerId(e.target.value)}
              className={`${inputClass} ${!defaultLedgerId ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-400 font-semibold text-amber-900' : 'border-emerald-500 font-semibold'}`}
            >
              <option value="">-- कृपया लेजर निवडा (अनिवार्य) --</option>
              {ledgers.map(l => (
                <option key={l.ledgerID} value={l.ledgerID}>
                  {l.ledgerName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>आरंभी दाखला क्र. (Start Cert No)</label>
            <input
              type="text"
              value={startCertNo}
              onChange={(e) => setStartCertNo(e.target.value)}
              placeholder="CERT-0001"
              className={`${inputClass} font-mono font-bold uppercase`}
            />
          </div>

          <div>
            <label className={labelClass}>आरंभी शेअर क्र. (Start Share No)</label>
            <input
              type="number"
              value={startShareNo}
              onChange={(e) => setStartShareNo(parseInt(e.target.value) || 1)}
              className={`${inputClass} font-mono font-bold`}
            />
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoSequenceAll}
              className="px-3 py-1 bg-primary hover:opacity-90 text-white rounded-sm text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>⚡ शेअर व दाखला क्रम आपोआप भरा (Auto Sequence)</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddRows(5)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            >
              <PlusCircle className="w-3.5 h-3.5 text-primary" />
              <span>+ ५ ओळी जोडा</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddRows(10)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            >
              <PlusCircle className="w-3.5 h-3.5 text-primary" />
              <span>+ १० ओळी जोडा</span>
            </button>

            <button
              type="button"
              onClick={handleRemoveEmptyRows}
              className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>रिकाम्या ओळी काढा</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-semibold">
            एकूण ओळी: <span className="font-bold text-slate-800">{rows.length}</span> | भरलेल्या: <span className="font-bold text-primary">{validRows.length}</span>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {message && (
        <div className={`p-2.5 rounded-sm flex items-center gap-2 text-[11px] font-bold mb-3 ${
          messageType === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' 
            : 'bg-rose-50 text-rose-900 border border-rose-300'
        }`}>
          {messageType === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
          <span>{message}</span>
        </div>
      )}

      {/* Overlap Warning Banner */}
      {overlappingRowIds.size > 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-2 rounded-sm flex flex-wrap items-center justify-between gap-2 mb-3 text-[11px] font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              ⚠️ काही ओळींमध्ये शेअर्स नंबर ओव्हरलॅप / डुप्लिकेट (Overlap) झाले आहेत (त्यामुळे शेवटचा शेअर नंबर एकूण संख्येपेक्षा कमी दिसू शकतो).
            </span>
          </div>
          <button
            type="button"
            onClick={handleAutoSequenceAll}
            className="bg-amber-700 hover:bg-amber-800 text-white px-3 py-1 rounded text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
          >
            ⚡ सर्व शेअर्स नंबर सलग दुरुस्त करा (Auto Sequence)
          </button>
        </div>
      )}

      {/* High Performance CBS Spreadsheet Grid */}
      <div className="bg-white rounded-sm border border-slate-200 shadow-xs flex-1 flex flex-col mb-3 overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] scrollbar-thin">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 select-none">
              <tr>
                <th className="py-2 px-1 text-center w-7 border-r border-slate-200">#</th>
                <th className="py-2 px-2 min-w-[280px] border-r border-slate-200">सभासदाचे नाव (Member Search) *</th>
                <th className="py-2 px-2 w-20 text-center border-r border-slate-200">शेअर्स संख्या *</th>
                <th className="py-2 px-2 w-18 text-center border-r border-slate-200">दर्शनी मूल्य (₹)</th>
                <th className="py-2 px-2 w-24 text-right border-r border-slate-200">एकूण रक्कम (₹) *</th>
                <th className="py-2 px-2 w-24 text-center border-r border-slate-200">शेअर क्र. पासून</th>
                <th className="py-2 px-2 w-24 text-center border-r border-slate-200">शेअर क्र. पर्यंत</th>
                <th className="py-2 px-2 w-24 text-center border-r border-slate-200">दाखला क्र.</th>
                <th className="py-2 px-2 w-20 text-center border-r border-slate-200">लाभांश येणे (₹)</th>
                <th className="py-2 px-2 text-center w-10">कृती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => {
                const isRowFilled = row.memberId !== '';
                const isRowOverlapping = overlappingRowIds.has(row.id);
                return (
                  <tr 
                    key={row.id} 
                    className={`hover:bg-primary/5 transition-colors ${
                      row.isExistingRecord ? 'bg-amber-50/40' : (isRowFilled ? 'bg-white' : 'bg-slate-50/50')
                    }`}
                  >
                    {/* Row Index */}
                    <td className="py-1 px-1 text-center font-mono font-bold text-slate-500 border-r border-slate-100 text-[10px]">
                      {index + 1}
                    </td>

                    {/* Member Search Select (With integrated Member Code & Cust ID badges) */}
                    <td className="py-1 px-2 border-r border-slate-100">
                      <div className="flex flex-col gap-0.5">
                        <MemberSearchSelect
                          members={members}
                          value={row.memberId || undefined}
                          onChange={(mId) => handleRowChange(row.id, 'memberId', mId)}
                          placeholder="सभासद शोधा (नाव, कोड, CIF)..."
                          className="w-full text-[11px]"
                        />
                        {row.isExistingRecord && (
                          <div className="flex items-center gap-1 text-[9px] text-purple-800 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 w-fit">
                            <span>✏️ आधीची नोंद (संपादन मोड)</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Share Quantity */}
                    <td className="py-1 px-1.5 border-r border-slate-100">
                      <input
                        type="number"
                        min="1"
                        value={row.shareQuantity}
                        onChange={(e) => handleRowChange(row.id, 'shareQuantity', e.target.value === '' ? '' : parseInt(e.target.value))}
                        placeholder="10"
                        className={`${gridInputClass} text-center font-bold`}
                      />
                    </td>

                    {/* Face Value */}
                    <td className="py-1 px-1.5 border-r border-slate-100">
                      <input
                        type="number"
                        value={row.faceValue}
                        onChange={(e) => handleRowChange(row.id, 'faceValue', parseFloat(e.target.value) || 100)}
                        className={`${gridInputClass} text-center bg-slate-50 text-slate-700`}
                      />
                    </td>

                    {/* Total Amount (Editable & Bidirectional) */}
                    <td className="py-1 px-1.5 border-r border-slate-100">
                      <input
                        type="number"
                        min="1"
                        value={row.totalAmount !== undefined && row.totalAmount !== null ? row.totalAmount : ''}
                        onChange={(e) => handleRowChange(row.id, 'totalAmount', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        placeholder="1000"
                        className={`${gridInputClass} text-right font-mono font-bold text-emerald-800`}
                      />
                    </td>

                    {/* From Share No */}
                    <td className="py-1 px-1.5 border-r border-slate-100">
                      <div className="flex flex-col items-center">
                        <input
                          type="number"
                          value={row.fromShareNo}
                          onChange={(e) => handleRowChange(row.id, 'fromShareNo', e.target.value === '' ? '' : parseInt(e.target.value))}
                          placeholder="1"
                          className={`${gridInputClass} text-center font-mono ${
                            isRowOverlapping 
                              ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-400 font-bold text-rose-700' 
                              : ''
                          }`}
                        />
                        {isRowOverlapping && (
                          <span className="text-[9px] text-rose-600 font-bold tracking-tight">⚠️ ओव्हरलॅप</span>
                        )}
                      </div>
                    </td>

                    {/* To Share No */}
                    <td className="py-1 px-1.5 border-r border-slate-100">
                      <input
                        type="number"
                        value={row.toShareNo}
                        onChange={(e) => handleRowChange(row.id, 'toShareNo', e.target.value === '' ? '' : parseInt(e.target.value))}
                        placeholder="10"
                        className={`${gridInputClass} text-center font-mono`}
                      />
                    </td>

                    {/* Certificate No */}
                    <td className="py-1 px-1.5 border-r border-slate-100">
                      <input
                        type="text"
                        value={row.certificateNo}
                        onChange={(e) => handleRowChange(row.id, 'certificateNo', e.target.value)}
                        placeholder="SC0001"
                        className={`${gridInputClass} text-center font-mono font-bold uppercase`}
                      />
                    </td>

                    {/* Dividend Payable */}
                    <td className="py-1 px-1.5 border-r border-slate-100">
                      <input
                        type="number"
                        value={row.dividendPayable}
                        onChange={(e) => handleRowChange(row.id, 'dividendPayable', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        placeholder="0"
                        className={`${gridInputClass} text-center font-mono`}
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-1 px-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                        title="ओळ काढा"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Batch Actions Bar */}
        <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRows(Array.from({ length: 10 }, () => createBlankRow()))}
              disabled={loading}
              className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>रीसेट (Reset)</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[11px] font-semibold text-slate-700 hidden sm:block">
              वैध: <span className="font-bold text-primary">{validRows.length}</span> | एकूण शेअर्स: <span className="font-bold text-emerald-700">{totalBatchShares.toLocaleString('en-IN')}</span> | एकूण रक्कम: <span className="font-bold text-primary">₹{totalBatchAmount.toLocaleString('en-IN')}</span>
            </div>

            <button
              type="button"
              onClick={handleSaveBatch}
              disabled={loading || validRows.length === 0}
              className={`px-5 py-1.5 rounded-sm text-xs font-bold text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                loading || validRows.length === 0
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>बॅच सेव्ह होत आहे...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>सर्व सेव्ह करा (Save All Batch - {validRows.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Excel Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-sm shadow-xl max-w-2xl w-full p-4 border border-slate-200">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-gray-900">
                  एक्सेल डेटा पेस्ट करा (Paste from Excel)
                </h3>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-gray-600 mb-2">
              तुमच्या एक्सेल शीटमधील ओळी कॉपी करून खालील बॉक्समध्ये पेस्ट करा (Tab-separated):
              <br />
              <strong>कॉलम क्रम:</strong> [सभासद कोड/CIF/नाव] [शेअर्स संख्या] [दर्शनी मूल्य] [शेअर क्र. पासून] [शेअर क्र. पर्यंत] [दाखला क्र.] [लाभांश]
            </p>

            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="MEM0001	10	100	1	10	SC0001&#10;MEM0002	20	100	11	30	SC0002"
              className="w-full font-mono text-[11px] p-2.5 rounded-sm border border-gray-300 bg-slate-50 text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
            />

            <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-3 py-1 text-[11px] font-bold text-gray-600 hover:bg-slate-100 rounded-sm border border-slate-300 cursor-pointer"
              >
                रद्द करा (Cancel)
              </button>
              <button
                type="button"
                onClick={handleApplyPastedData}
                disabled={!pastedText.trim()}
                className="px-4 py-1 text-[11px] font-bold text-white bg-primary hover:opacity-90 rounded-sm shadow-2xs cursor-pointer disabled:opacity-50"
              >
                डेटा ग्रिडमध्ये भरा (Apply to Grid)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareOpeningBalanceBulk;
