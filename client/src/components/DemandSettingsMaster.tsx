import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Save,
  Settings,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Info,
  Archive,
  RotateCcw,
  Lock
} from 'lucide-react';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissionUtils';

interface LoanRateOption {
  loanRateID: number;
  loanType: string;
  loanCode: string;
  shortName?: string;
  loanLedgerID?: number;
  interestLedgerID?: number;
  receivableInterestLedgerID?: number;
  overdueInterestLedgerID?: number;
}

interface SavingSchemeOption {
  settingID: number;
  schemeCode: string;
  schemeName: string;
  interestRate: number;
  postingFrequency: string;
  savingLiabilityLedgerID?: number;
  ledgerID?: number;
}

interface RdSchemeOption {
  rdSchemeID: number;
  schemeCode: string;
  schemeName: string;
  durationMonths: number;
  minimumInstallment: number;
  rdLiabilityLedgerID?: number;
}

interface ShareSchemeOption {
  shareSchemeId: number;
  schemeCode: string;
  schemeName: string;
  shareFaceValue: number;
  shareCapitalLedgerID?: number;
}

interface PigmySchemeOption {
  pigmySchemeID: number;
  schemeCode: string;
  schemeName: string;
  durationMonths?: number;
  interestRate: number;
  pigmyLiabilityLedgerID?: number;
}

interface LedgerOption {
  ledgerID: number;
  ledgerCode: string;
  ledgerName: string;
  accountType?: string;
  groupID?: number;
  groupName?: string;
  natureOfGroup?: string;
  isDepositLedger?: boolean;
  linkedSchemeSource?: string;
}

export interface DemandColumnSettingRow {
  demandColumnSettingId: number;
  sequenceOrder: number;
  columnHeaderMr: string;
  itemType: 'LOAN' | 'THRIFT_SAVING' | 'DEPOSIT_LEDGER' | 'RD' | 'PIGMY' | 'SHARE' | 'LEDGER_OTHER';
  loanRateID?: number | null;
  savingSchemeID?: number | null;
  rdSchemeID?: number | null;
  shareSchemeId?: number | null;
  pigmySchemeID?: number | null;
  principalOrDepositLedgerID?: number | null;
  interestLedgerID?: number | null;
  receivableInterestLedgerID?: number | null;
  overdueInterestLedgerID?: number | null;
  showBalanceColumn: boolean;
  includeOverduePenalInterest: boolean;
  loanIntraAllocationOrder: 'INTEREST_FIRST' | 'PRINCIPAL_FIRST';
  isContributionTarget: boolean;
  defaultAmount: number;
  isActive: boolean;
}

interface DemandColumnSettingUiRow extends DemandColumnSettingRow {
  clientKey: string;
  defaultAmountDraft: string;
  lastAutoHeader?: string;
}

interface DemandSettingsMasterProps {
  onNavigate?: (tab: string) => void;
}

type LedgerSlotRole = 'principal' | 'interest' | 'receivable' | 'overdue';

const createClientKey = () =>
  `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const toUiRow = (row: DemandColumnSettingRow, idx: number, lastAutoHeader?: string): DemandColumnSettingUiRow => ({
  ...row,
  sequenceOrder: idx + 1,
  isActive: true,
  clientKey: createClientKey(),
  defaultAmount: Number(row.defaultAmount || 0),
  defaultAmountDraft: Number(row.defaultAmount || 0) === 0 ? '' : String(Number(row.defaultAmount || 0)),
  lastAutoHeader: lastAutoHeader ?? row.columnHeaderMr
});

const toPayloadRow = (row: DemandColumnSettingUiRow, seq: number): DemandColumnSettingRow => ({
  demandColumnSettingId: row.demandColumnSettingId,
  sequenceOrder: seq,
  columnHeaderMr: row.columnHeaderMr.trim(),
  itemType: row.itemType,
  loanRateID: row.itemType === 'LOAN' ? (row.loanRateID ?? null) : null,
  savingSchemeID: row.itemType === 'THRIFT_SAVING' ? (row.savingSchemeID ?? null) : null,
  rdSchemeID: row.itemType === 'RD' ? (row.rdSchemeID ?? null) : null,
  shareSchemeId: row.itemType === 'SHARE' ? (row.shareSchemeId ?? null) : null,
  pigmySchemeID: row.itemType === 'PIGMY' ? (row.pigmySchemeID ?? null) : null,
  principalOrDepositLedgerID: row.principalOrDepositLedgerID ?? null,
  interestLedgerID: row.itemType === 'LOAN' ? (row.interestLedgerID ?? null) : null,
  receivableInterestLedgerID: row.itemType === 'LOAN' ? (row.receivableInterestLedgerID ?? null) : null,
  overdueInterestLedgerID: row.itemType === 'LOAN' ? (row.overdueInterestLedgerID ?? null) : null,
  showBalanceColumn: row.itemType === 'LOAN' ? row.showBalanceColumn : false,
  includeOverduePenalInterest: row.itemType === 'LOAN' ? row.includeOverduePenalInterest : false,
  loanIntraAllocationOrder: row.loanIntraAllocationOrder || 'INTEREST_FIRST',
  isContributionTarget:
    row.itemType === 'THRIFT_SAVING' ||
    row.itemType === 'DEPOSIT_LEDGER' ||
    row.itemType === 'PIGMY' ||
    row.itemType === 'LEDGER_OTHER'
      ? row.isContributionTarget
      : false,
  defaultAmount: Math.max(0, Math.round((Number(row.defaultAmount) || 0) * 100) / 100),
  isActive: true
});

const serializeSnapshot = (list: DemandColumnSettingUiRow[]) =>
  JSON.stringify(list.map((r, i) => toPayloadRow(r, i + 1)));

const isCashOrBankLedger = (l: LedgerOption): boolean => {
  const acctType = (l.accountType || '').trim().toLowerCase();
  return acctType.includes('cash') || acctType.includes('bank');
};

const getExpectedNatures = (
  itemType: DemandColumnSettingRow['itemType'],
  slotRole: LedgerSlotRole
): string[] => {
  if (slotRole === 'interest' || slotRole === 'overdue') return ['Income'];
  if (slotRole === 'receivable') return ['Assets'];
  if (itemType === 'LOAN') return ['Assets'];
  if (itemType === 'LEDGER_OTHER') return ['Liabilities', 'Income', 'Assets'];
  return ['Liabilities'];
};

const getNatureBadgeColor = (nature?: string, isInvalid?: boolean): string => {
  if (isInvalid) return 'bg-red-100 text-red-800 border-red-300';
  const norm = (nature || '').trim().toLowerCase();
  if (norm === 'liabilities') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (norm === 'income') return 'bg-indigo-100 text-indigo-800 border-indigo-300';
  if (norm === 'assets') return 'bg-amber-100 text-amber-800 border-amber-300';
  return 'bg-slate-100 text-slate-700 border-slate-300';
};

const isLedgerValidForSlot = (
  ledger: LedgerOption | undefined,
  itemType: DemandColumnSettingRow['itemType'],
  slotRole: LedgerSlotRole
): boolean => {
  if (!ledger || isCashOrBankLedger(ledger)) return false;
  const expected = getExpectedNatures(itemType, slotRole);
  const nature = (ledger.natureOfGroup || '').trim().toLowerCase();
  return expected.some((n) => n.toLowerCase() === nature);
};

const buildDemandLedgerOptions = (
  ledgers: LedgerOption[],
  itemType: DemandColumnSettingRow['itemType'],
  slotRole: LedgerSlotRole,
  currentLedgerId?: number | null,
  clearLabel?: string
): SearchableSelectOption[] => {
  const expected = getExpectedNatures(itemType, slotRole);
  const matching = ledgers
    .filter((l) => !isCashOrBankLedger(l) && expected.some((n) => n.toLowerCase() === (l.natureOfGroup || '').trim().toLowerCase()))
    .slice()
    .sort((a, b) => {
      if (slotRole === 'principal' && itemType !== 'LOAN') {
        const depDiff = (b.isDepositLedger ? 1 : 0) - (a.isDepositLedger ? 1 : 0);
        if (depDiff !== 0) return depDiff;
        const srcDiff = (b.linkedSchemeSource ? 1 : 0) - (a.linkedSchemeSource ? 1 : 0);
        if (srcDiff !== 0) return srcDiff;
      }
      return (a.ledgerName || '').localeCompare(b.ledgerName || '');
    });

  const options: SearchableSelectOption[] = [];
  if (clearLabel) {
    options.push({
      value: '',
      label: clearLabel,
      subLabel: 'ऐच्छिक — निवड काढण्यासाठी क्लिक करा'
    });
  }

  matching.forEach((l) => {
    const metaParts = [
      `ID: ${l.ledgerID}`,
      l.groupName || l.accountType || '',
      l.linkedSchemeSource || ''
    ].filter(Boolean);
    const isPrioritizedDeposit = Boolean(l.isDepositLedger) && slotRole === 'principal' && itemType !== 'LOAN';

    options.push({
      value: l.ledgerID,
      label: `${l.ledgerName} (${l.ledgerCode || l.ledgerID})`,
      subLabel: metaParts.join(' | '),
      badge: isPrioritizedDeposit ? 'ठेव लेजर' : (l.natureOfGroup || 'Ledger'),
      badgeColor: getNatureBadgeColor(l.natureOfGroup, false)
    });
  });

  if (currentLedgerId && !matching.some((l) => l.ledgerID === currentLedgerId)) {
    const legacy = ledgers.find((l) => l.ledgerID === currentLedgerId);
    if (legacy) {
      options.unshift({
        value: legacy.ledgerID,
        label: `⚠️ ${legacy.ledgerName} (${legacy.ledgerCode || legacy.ledgerID})`,
        subLabel: `अमान्य खाते गट: ${legacy.natureOfGroup || legacy.accountType || 'Unknown'} — अपेक्षित: ${expected.join(' / ')}`,
        badge: 'दुरुस्त करा',
        badgeColor: getNatureBadgeColor(legacy.natureOfGroup, true)
      });
    }
  }

  return options;
};

const extractApiErrorMessage = (err: any, fallback: string): string => {
  const status = err?.response?.status;
  const data = err?.response?.data;

  if (typeof data === 'string' && data.trim().length > 0) {
    return data.trim();
  }

  if (data && typeof data === 'object') {
    const fieldErrors = data.errors && typeof data.errors === 'object'
      ? Object.values(data.errors).flat().filter((x: any) => typeof x === 'string' && x.trim().length > 0)
      : [];
    if (fieldErrors.length > 0) {
      return fieldErrors.join(' | ');
    }
    if (typeof data.message === 'string' && data.message.trim().length > 0) {
      return data.message.trim();
    }
    if (typeof data.title === 'string' && data.title.trim().length > 0) {
      return data.title.trim();
    }
  }

  if (status === 401) {
    return 'तुमचे लॉगिन सत्र संपले आहे (401). कृपया पुन्हा लॉगिन करा.';
  }
  if (status === 403) {
    return 'संस्थेचे डिमांड सेटिंग्ज पाहण्याची किंवा बदलण्याची परवानगी फक्त Head Office / Admin यांना आहे (403).';
  }

  return fallback;
};

const validateSettingsRows = (
  rows: DemandColumnSettingUiRow[],
  ledgersMap: Map<number, LedgerOption>
): string | null => {
  if (rows.length === 0) {
    return 'कृपया किमान एक डिमांड रकाना जोडा.';
  }

  const seenLoans = new Set<number>();
  const seenSavings = new Set<number>();
  const seenDepositLedgers = new Set<number>();
  const seenRds = new Set<number>();
  const seenPigmy = new Set<number>();
  const seenShares = new Set<number>();
  let seenGenericShare = false;
  let contribCount = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const seq = idx + 1;
    const header = r.columnHeaderMr.trim();

    if (r.isContributionTarget) {
      if (
        r.itemType !== 'THRIFT_SAVING' &&
        r.itemType !== 'DEPOSIT_LEDGER' &&
        r.itemType !== 'PIGMY' &&
        r.itemType !== 'LEDGER_OTHER'
      ) {
        return `क्रम ${seq}: 'वर्गणी ठेव Auto-Fill लक्ष्य' फक्त ठेव, पिग्मी किंवा इतर लेजर कॉलमसाठीच निवडता येते.`;
      }
      contribCount++;
    }

    if (r.itemType === 'LOAN') {
      if (!r.loanRateID) return `क्रम ${seq}: कृपया वैध कर्ज योजना निवडा.`;
      if (seenLoans.has(r.loanRateID)) return `क्रम ${seq} (${header || 'कर्ज'}): ही कर्ज योजना एकापेक्षा जास्त वेळा जोडता येत नाही.`;
      seenLoans.add(r.loanRateID);
    } else if (r.itemType === 'THRIFT_SAVING') {
      if (!r.savingSchemeID) return `क्रम ${seq}: कृपया वैध संजीवनी / बचत ठेव योजना निवडा.`;
      if (seenSavings.has(r.savingSchemeID)) return `क्रम ${seq} (${header || 'ठेव'}): ही ठेव योजना एकापेक्षा जास्त वेळा जोडता येत नाही.`;
      seenSavings.add(r.savingSchemeID);
    } else if (r.itemType === 'DEPOSIT_LEDGER') {
      if (!r.principalOrDepositLedgerID) return `क्रम ${seq}: कृपया वैध ठेवीचे लेजर निवडा.`;
      if (seenDepositLedgers.has(r.principalOrDepositLedgerID)) {
        return `क्रम ${seq} (${header || 'ठेव लेजर'}): हे ठेवीचे लेजर एकापेक्षा जास्त वेळा जोडता येत नाही.`;
      }
      seenDepositLedgers.add(r.principalOrDepositLedgerID);
    } else if (r.itemType === 'RD') {
      if (!r.rdSchemeID) return `क्रम ${seq}: कृपया वैध आवर्ती ठेव (RD) योजना निवडा.`;
      if (seenRds.has(r.rdSchemeID)) return `क्रम ${seq} (${header || 'RD'}): ही RD योजना एकापेक्षा जास्त वेळा जोडता येत नाही.`;
      seenRds.add(r.rdSchemeID);
    } else if (r.itemType === 'PIGMY') {
      if (!r.pigmySchemeID) return `क्रम ${seq}: कृपया वैध पिग्मी (Pigmy) ठेव योजना निवडा.`;
      if (seenPigmy.has(r.pigmySchemeID)) return `क्रम ${seq} (${header || 'पिग्मी'}): ही पिग्मी योजना एकापेक्षा जास्त वेळा जोडता येत नाही.`;
      seenPigmy.add(r.pigmySchemeID);
    } else if (r.itemType === 'SHARE') {
      if (r.shareSchemeId) {
        if (seenShares.has(r.shareSchemeId)) return `क्रम ${seq} (${header || 'शेअर्स'}): ही शेअर योजना एकापेक्षा जास्त वेळा जोडता येत नाही.`;
        seenShares.add(r.shareSchemeId);
      } else {
        if (seenGenericShare) return `क्रम ${seq}: सामान्य 'शेअर्स' कॉलम एकापेक्षा जास्त वेळा जोडता येत नाही.`;
        seenGenericShare = true;
      }
    }

    if (!header) {
      return `क्रम ${seq}: कॉलमचे नाव (Display Header) भरणे आवश्यक आहे.`;
    }

    const prinLedger = r.principalOrDepositLedgerID ? ledgersMap.get(r.principalOrDepositLedgerID) : undefined;
    if (!r.principalOrDepositLedgerID) {
      return `क्रम ${seq} ('${header}'): कृपया मुद्दल / ठेव जमा लेजर निवडा.`;
    }
    if (!isLedgerValidForSlot(prinLedger, r.itemType, 'principal')) {
      const expected = getExpectedNatures(r.itemType, 'principal').join(' / ');
      return `क्रम ${seq} ('${header}'): निवडलेले जमा लेजर अमान्य आहे (अपेक्षित खाते गट: ${expected}, रोख/बँक चालणार नाही).`;
    }

    if (r.itemType === 'LOAN') {
      const intLedger = r.interestLedgerID ? ledgersMap.get(r.interestLedgerID) : undefined;
      if (!r.interestLedgerID) {
        return `क्रम ${seq} ('${header}'): कृपया चालू व्याज उत्पन्न लेजर निवडा.`;
      }
      if (!isLedgerValidForSlot(intLedger, 'LOAN', 'interest')) {
        return `क्रम ${seq} ('${header}'): चालू व्याज लेजर 'Income' खाते गटातील असणे आवश्यक आहे.`;
      }

      if (r.receivableInterestLedgerID) {
        const recLedger = ledgersMap.get(r.receivableInterestLedgerID);
        if (!isLedgerValidForSlot(recLedger, 'LOAN', 'receivable')) {
          return `क्रम ${seq} ('${header}'): येणे व्याज लेजर 'Assets' खाते गटातील असणे आवश्यक आहे.`;
        }
      }

      if (r.overdueInterestLedgerID) {
        const ovdLedger = ledgersMap.get(r.overdueInterestLedgerID);
        if (!isLedgerValidForSlot(ovdLedger, 'LOAN', 'overdue')) {
          return `क्रम ${seq} ('${header}'): थकीत दंडव्याज लेजर 'Income' खाते गटातील असणे आवश्यक आहे.`;
        }
      }
    }
  }

  if (contribCount > 1) {
    return "फक्त एकच ठेव/वर्गणी कॉलम 'वर्गणी ठेव Auto-Fill' म्हणून निवडता येईल.";
  }

  return null;
};

export default function DemandSettingsMaster({ onNavigate }: DemandSettingsMasterProps) {
  const { user } = useAuth();
  const canEditSettings = hasPermission(user?.role, 'Settings', 'Edit');

  const [rows, setRows] = useState<DemandColumnSettingUiRow[]>([]);
  const [inactiveSettings, setInactiveSettings] = useState<DemandColumnSettingRow[]>([]);
  const [suggestedDefaults, setSuggestedDefaults] = useState<DemandColumnSettingRow[]>([]);
  const [loanRates, setLoanRates] = useState<LoanRateOption[]>([]);
  const [savingSchemes, setSavingSchemes] = useState<SavingSchemeOption[]>([]);
  const [rdSchemes, setRdSchemes] = useState<RdSchemeOption[]>([]);
  const [pigmySchemes, setPigmySchemes] = useState<PigmySchemeOption[]>([]);
  const [shareSchemes, setShareSchemes] = useState<ShareSchemeOption[]>([]);
  const [depositLedgers, setDepositLedgers] = useState<LedgerOption[]>([]);
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);
  const [savedSnapshotJson, setSavedSnapshotJson] = useState<string>('[]');
  const [showArchived, setShowArchived] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const ledgersMap = useMemo(() => {
    const m = new Map<number, LedgerOption>();
    ledgers.forEach((l) => m.set(l.ledgerID, l));
    return m;
  }, [ledgers]);

  const isDirty = useMemo(() => {
    if (loading) return false;
    return serializeSnapshot(rows) !== savedSnapshotJson;
  }, [rows, savedSnapshotJson, loading]);

  useEffect(() => {
    if (!isDirty || !canEditSettings) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, canEditSettings]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/DemandSettings');
      const data = res.data || {};
      const configured = Boolean(data.isConfigured);
      setIsConfigured(configured);
      setLoanRates(data.loanRates || []);
      setSavingSchemes(data.savingSchemes || []);
      setRdSchemes(data.rdSchemes || []);
      setPigmySchemes(data.pigmySchemes || []);
      setShareSchemes(data.shareSchemes || []);
      setDepositLedgers(data.depositLedgers || []);
      setLedgers(data.ledgers || []);
      setSuggestedDefaults(data.suggestedDefaults || []);
      setInactiveSettings(Array.isArray(data.inactiveSettings) ? data.inactiveSettings : []);

      const loaded: DemandColumnSettingRow[] =
        data.settings && data.settings.length > 0
          ? data.settings
          : data.suggestedDefaults || [];

      const uiRows = loaded
        .slice()
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
        .map((r, idx) => toUiRow(r, idx));

      setRows(uiRows);
      setSavedSnapshotJson(configured ? serializeSnapshot(uiRows) : '[]');
    } catch (err: any) {
      setError(extractApiErrorMessage(err, 'डिमांड सेटिंग्ज लोड करताना त्रुटी आली.'));
    } finally {
      setLoading(false);
    }
  };

  const resequence = (list: DemandColumnSettingUiRow[]): DemandColumnSettingUiRow[] =>
    list.map((item, idx) => ({ ...item, sequenceOrder: idx + 1 }));

  const handleMove = (clientKey: string, direction: -1 | 1) => {
    if (!canEditSettings) return;
    const index = rows.findIndex((r) => r.clientKey === clientKey);
    const targetIdx = index + direction;
    if (index < 0 || targetIdx < 0 || targetIdx >= rows.length) return;
    const copy = rows.slice();
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    setRows(resequence(copy));
  };

  const handleAddRow = () => {
    if (!canEditSettings) return;
    setRows((prev) =>
      resequence([
        ...prev,
        toUiRow(
          {
            demandColumnSettingId: 0,
            sequenceOrder: prev.length + 1,
            columnHeaderMr: '',
            itemType: 'LOAN',
            loanRateID: null,
            savingSchemeID: null,
            rdSchemeID: null,
            shareSchemeId: null,
            principalOrDepositLedgerID: null,
            interestLedgerID: null,
            receivableInterestLedgerID: null,
            overdueInterestLedgerID: null,
            showBalanceColumn: true,
            includeOverduePenalInterest: false,
            loanIntraAllocationOrder: 'INTEREST_FIRST',
            isContributionTarget: false,
            defaultAmount: 0,
            isActive: true
          },
          prev.length,
          ''
        )
      ])
    );
  };

  const handleRemoveRow = (row: DemandColumnSettingUiRow) => {
    if (!canEditSettings) return;
    if (row.demandColumnSettingId > 0) {
      const confirmed = window.confirm(
        `हा रकाना ('${row.columnHeaderMr || row.itemType}') काढून टाकायचा का?\nजुन्या डिमांड नोटीसमध्ये वापरलेला असल्यास तो निष्क्रिय (Archived) केला जाईल.`
      );
      if (!confirmed) return;
    }
    setRows((prev) => resequence(prev.filter((r) => r.clientKey !== row.clientKey)));
  };

  const handleRestoreArchived = (archived: DemandColumnSettingRow) => {
    if (!canEditSettings) return;
    setError('');

    const duplicate = rows.some((r) => {
      if (r.itemType !== archived.itemType) return false;
      if (archived.itemType === 'LOAN') return r.loanRateID === archived.loanRateID;
      if (archived.itemType === 'THRIFT_SAVING') return r.savingSchemeID === archived.savingSchemeID;
      if (archived.itemType === 'RD') return r.rdSchemeID === archived.rdSchemeID;
      if (archived.itemType === 'SHARE') return r.shareSchemeId === archived.shareSchemeId;
      return false;
    });

    if (duplicate) {
      setError(`'${archived.columnHeaderMr}' ही योजना आधीच सक्रिय यादीत जोडलेली आहे.`);
      return;
    }

    setRows((prev) =>
      resequence([
        ...prev,
        toUiRow(
          {
            ...archived,
            isContributionTarget: false,
            isActive: true
          },
          prev.length
        )
      ])
    );
    setInactiveSettings((prev) =>
      prev.filter((x) => x.demandColumnSettingId !== archived.demandColumnSettingId)
    );
    setSuccess(`'${archived.columnHeaderMr}' यादीत पुनर्स्थापित केले — बदल कायम करण्यासाठी "सेटिंग्ज जतन करा" क्लिक करा.`);
  };

  const handleTypeChange = (clientKey: string, newType: DemandColumnSettingRow['itemType']) => {
    if (!canEditSettings) return;
    setRows((prev) =>
      prev.map((row) => {
        if (row.clientKey !== clientKey) return row;
        const headerWasAuto = !row.columnHeaderMr.trim() || row.columnHeaderMr === row.lastAutoHeader;
        const nextAmt = newType === 'LOAN' ? 0 : row.defaultAmount;
        return {
          ...row,
          itemType: newType,
          loanRateID: null,
          savingSchemeID: null,
          rdSchemeID: null,
          pigmySchemeID: null,
          shareSchemeId: null,
          principalOrDepositLedgerID: null,
          interestLedgerID: null,
          receivableInterestLedgerID: null,
          overdueInterestLedgerID: null,
          columnHeaderMr: headerWasAuto ? '' : row.columnHeaderMr,
          lastAutoHeader: headerWasAuto ? '' : row.lastAutoHeader,
          showBalanceColumn: newType === 'LOAN',
          includeOverduePenalInterest: false,
          isContributionTarget:
            newType === 'THRIFT_SAVING' ||
            newType === 'DEPOSIT_LEDGER' ||
            newType === 'PIGMY' ||
            newType === 'LEDGER_OTHER'
              ? row.isContributionTarget
              : false,
          defaultAmount: nextAmt,
          defaultAmountDraft: nextAmt === 0 ? '' : String(nextAmt)
        };
      })
    );
  };

  const handleSchemeChange = (clientKey: string, schemeIdStr: string) => {
    if (!canEditSettings) return;
    const schemeId = schemeIdStr ? Number(schemeIdStr) : null;
    setRows((prev) =>
      prev.map((row) => {
        if (row.clientKey !== clientKey) return row;

        if (row.itemType === 'LOAN') {
          const lr = loanRates.find((l) => l.loanRateID === schemeId);
          const autoName = lr ? (lr.shortName || lr.loanType) : '';
          return {
            ...row,
            loanRateID: schemeId,
            columnHeaderMr: lr ? autoName : row.columnHeaderMr,
            lastAutoHeader: lr ? autoName : row.lastAutoHeader,
            principalOrDepositLedgerID: lr?.loanLedgerID ?? null,
            interestLedgerID: lr?.interestLedgerID ?? null,
            receivableInterestLedgerID: lr?.receivableInterestLedgerID ?? null,
            overdueInterestLedgerID: lr?.overdueInterestLedgerID ?? null
          };
        }

        if (row.itemType === 'THRIFT_SAVING') {
          const ss = savingSchemes.find((s) => s.settingID === schemeId);
          const autoName = ss ? ss.schemeName : '';
          return {
            ...row,
            savingSchemeID: schemeId,
            columnHeaderMr: ss ? autoName : row.columnHeaderMr,
            lastAutoHeader: ss ? autoName : row.lastAutoHeader,
            principalOrDepositLedgerID: ss?.savingLiabilityLedgerID ?? ss?.ledgerID ?? null
          };
        }

        if (row.itemType === 'DEPOSIT_LEDGER') {
          const dep = (depositLedgers.length > 0 ? depositLedgers : ledgers).find((l) => l.ledgerID === schemeId);
          const autoName = dep ? dep.ledgerName : '';
          const headerWasAuto = !row.columnHeaderMr.trim() || row.columnHeaderMr === row.lastAutoHeader;
          return {
            ...row,
            principalOrDepositLedgerID: schemeId,
            columnHeaderMr: dep && headerWasAuto ? autoName : row.columnHeaderMr,
            lastAutoHeader: dep ? autoName : row.lastAutoHeader
          };
        }

        if (row.itemType === 'RD') {
          const rd = rdSchemes.find((r) => r.rdSchemeID === schemeId);
          const autoName = rd ? rd.schemeName : '';
          const minInst = rd ? Number(rd.minimumInstallment || 0) : row.defaultAmount;
          return {
            ...row,
            rdSchemeID: schemeId,
            columnHeaderMr: rd ? autoName : row.columnHeaderMr,
            lastAutoHeader: rd ? autoName : row.lastAutoHeader,
            principalOrDepositLedgerID: rd?.rdLiabilityLedgerID ?? null,
            defaultAmount: minInst,
            defaultAmountDraft: minInst === 0 ? '' : String(minInst)
          };
        }

        if (row.itemType === 'PIGMY') {
          const pg = pigmySchemes.find((p) => p.pigmySchemeID === schemeId);
          const autoName = pg ? pg.schemeName : '';
          return {
            ...row,
            pigmySchemeID: schemeId,
            columnHeaderMr: pg ? autoName : row.columnHeaderMr,
            lastAutoHeader: pg ? autoName : row.lastAutoHeader,
            principalOrDepositLedgerID: pg?.pigmyLiabilityLedgerID ?? null
          };
        }

        if (row.itemType === 'SHARE') {
          const sh = shareSchemes.find((s) => s.shareSchemeId === schemeId);
          const autoName = sh ? sh.schemeName : '';
          return {
            ...row,
            shareSchemeId: schemeId,
            columnHeaderMr: sh ? autoName : row.columnHeaderMr,
            lastAutoHeader: sh ? autoName : row.lastAutoHeader,
            principalOrDepositLedgerID: sh?.shareCapitalLedgerID ?? null
          };
        }

        return row;
      })
    );
  };

  const handleContributionTargetSelect = (clientKey: string | null) => {
    if (!canEditSettings) return;
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        isContributionTarget: clientKey !== null && row.clientKey === clientKey
      }))
    );
  };

  const handleDefaultAmountDraftChange = (clientKey: string, raw: string) => {
    if (!canEditSettings) return;
    if (raw !== '' && !/^\d*(\.\d{0,2})?$/.test(raw)) return;
    const parsed = raw === '' || raw === '.' ? 0 : Math.max(0, Number(raw) || 0);
    setRows((prev) =>
      prev.map((r) =>
        r.clientKey === clientKey ? { ...r, defaultAmountDraft: raw, defaultAmount: parsed } : r
      )
    );
  };

  const handleDefaultAmountBlur = (clientKey: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.clientKey !== clientKey) return r;
        const cleanNum = Math.max(0, Math.round((Number(r.defaultAmount) || 0) * 100) / 100);
        return {
          ...r,
          defaultAmount: cleanNum,
          defaultAmountDraft: cleanNum === 0 ? '' : String(cleanNum)
        };
      })
    );
  };

  const handleSave = async () => {
    if (!canEditSettings) return;
    setError('');
    setSuccess('');

    const clientError = validateSettingsRows(rows, ledgersMap);
    if (clientError) {
      setError(clientError);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        items: rows.map((r, idx) => toPayloadRow(r, idx + 1))
      };
      const res = await axios.put('/api/DemandSettings', payload);
      setIsConfigured(true);

      const savedSettings: DemandColumnSettingRow[] = res.data?.settings || [];
      if (savedSettings.length > 0) {
        const uiRows = savedSettings
          .slice()
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
          .map((s, idx) => toUiRow(s, idx));
        setRows(uiRows);
        setSavedSnapshotJson(serializeSnapshot(uiRows));
      } else {
        setSavedSnapshotJson(serializeSnapshot(rows));
      }

      if (Array.isArray(res.data?.inactiveSettings)) {
        setInactiveSettings(res.data.inactiveSettings);
      }

      setSuccess(res.data?.message || 'डिमांड सेटिंग्ज यशस्वीरीत्या जतन केल्या आहेत!');
    } catch (err: any) {
      setError(extractApiErrorMessage(err, 'डिमांड सेटिंग्ज जतन करताना त्रुटी आली.'));
    } finally {
      setSaving(false);
    }
  };

  const handleNavigateBack = () => {
    if (!onNavigate) return;
    if (isDirty && canEditSettings) {
      const proceed = window.confirm(
        'डिमांड सेटिंग्जमधील बदल अद्याप जतन केलेले नाहीत. जतन न करता डिमांड फॉर्मवर जायचे का?'
      );
      if (!proceed) return;
    }
    onNavigate('demand-notice');
  };

  return (
    <div className="p-2 max-w-[1440px] mx-auto font-sans text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-3 border-b-2 border-primary">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-primary text-white">
            <Settings size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-800">
                कर्मचारी पगार डिमांड सेटिंग्ज (Sanstha Default Sequence &amp; Ledger Setting)
              </h1>
              {!canEditSettings && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                  <Lock size={11} /> फक्त पाहण्यासाठी (Read-Only)
                </span>
              )}
              {isDirty && canEditSettings && (
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                  ● जतन बाकी
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              संपूर्ण संस्थेसाठी एकमेव डिफॉल्ट सेटिंग — डिमांड कॉलम्सचा क्रम, एकापेक्षा जास्त RD स्कीम उप-ओळी व वसुली प्राधान्यक्रम
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEditSettings && !isConfigured && suggestedDefaults.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setRows(
                  suggestedDefaults
                    .slice()
                    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                    .map((d, idx) => toUiRow(d, idx))
                )
              }
              className="px-2.5 py-1.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Sparkles size={14} /> डिफॉल्ट सुचवलेला क्रम भरा
            </button>
          )}
          {inactiveSettings.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Archive size={14} /> निष्क्रिय सेटिंग्ज ({inactiveSettings.length})
            </button>
          )}
          {canEditSettings && (
            <>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> नवीन योजना / कॉलम जोडा
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="px-3.5 py-1.5 rounded bg-primary hover:opacity-95 text-white font-bold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'जतन होत आहे...' : 'सेटिंग्ज जतन करा'}
              </button>
            </>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={handleNavigateBack}
              className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm cursor-pointer"
            >
              डिमांड फॉर्मवर जा →
            </button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-3 p-2.5 rounded border border-blue-200 bg-blue-50/80 text-blue-950 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5 text-blue-700" />
        <div className="space-y-0.5 text-[11px] leading-relaxed">
          <div>
            <strong>१) `क्रम (Sequence)` चा दुहेरी उपयोग:</strong> फॉर्म व प्रिंट यादीत कॉलम्स डावीकडून उजवीकडे याच क्रमाने दिसतील, आणि पगारातून अपुरी (कमी) कपात आल्यास याच प्राधान्यक्रमाने वसुली जमा होईल.
          </div>
          <div>
            <strong>२) एकापेक्षा जास्त RD स्कीम:</strong> प्रत्येक सक्रिय RD स्कीम येथे स्वतंत्र ओळीत जोडा व क्रम द्या. डिमांड फॉर्म व प्रिंटवर एकत्रित RD कॉलम पहिल्या RD च्या क्रमावर दिसेल, तर एकाच कर्मचाऱ्याच्या खाली प्रत्येक अतिरिक्त RD साठी सेटिंगच्या क्रमाप्रमाणे उप-ओळ (Sub-Row) व वसुली प्राधान्य चालेल.
          </div>
          <div>
            <strong>३) संजीवनी ठेव / वर्गणी ठेव:</strong> या प्रकाराला <strong>'वर्गणी ठेव Auto-Fill'</strong> चिन्हांकित केल्यास डिमांड फॉर्मवरील वर्गणी रक्कम टाकून 'पहा' क्लिक करताच सर्व कर्मचाऱ्यांत ती रक्कम आपोआप भरली जाईल.
          </div>
        </div>
      </div>

      {!isConfigured && (
        <div className="mb-2 p-2 rounded border border-amber-300 bg-amber-50 text-amber-900 font-semibold text-[11px]">
          ⚠️ संस्थेची डिमांड सेटिंग अद्याप जतन केलेली नाही. खालील सुचवलेला क्रम तपासा, सर्व लेजर (Credit / Interest) जुळवा आणि <strong>"सेटिंग्ज जतन करा"</strong> क्लिक करा.
        </div>
      )}

      {showArchived && inactiveSettings.length > 0 && (
        <div className="mb-3 p-2.5 rounded border border-slate-300 bg-slate-50 space-y-1.5">
          <div className="font-bold text-slate-700 flex items-center gap-1.5">
            <Archive size={14} /> निष्क्रिय (Archived) डिमांड कॉलम सेटिंग्ज — जुन्या नोटीससाठी जतन केलेले
          </div>
          <div className="flex flex-wrap gap-2">
            {inactiveSettings.map((arch) => (
              <div
                key={arch.demandColumnSettingId}
                className="flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-300 rounded text-[11px]"
              >
                <span className="font-semibold text-slate-800">{arch.columnHeaderMr}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">{arch.itemType}</span>
                {canEditSettings && (
                  <button
                    type="button"
                    onClick={() => handleRestoreArchived(arch)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                  >
                    <RotateCcw size={11} /> पुन्हा सक्रिय करा
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-2 p-2 rounded border border-red-300 bg-red-50 text-red-700 font-semibold flex items-center gap-1.5">
          <AlertCircle size={15} className="shrink-0" /> <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-2 p-2 rounded border border-green-300 bg-green-50 text-green-800 font-semibold flex items-center gap-1.5">
          <CheckCircle2 size={15} className="shrink-0" /> <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500 bg-white border rounded">डिमांड सेटिंग्ज लोड होत आहेत...</div>
      ) : (
        <div className="bg-white border border-slate-300 rounded shadow-sm overflow-x-auto">
          <table className="min-w-full border-collapse text-[11px]">
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-2 py-2 border border-slate-400/40 w-20 text-center">क्रम (Seq)</th>
                <th className="px-2 py-2 border border-slate-400/40 w-36 text-left">प्रकार (Type)</th>
                <th className="px-2 py-2 border border-slate-400/40 w-52 text-left">योजना निवडा (Scheme)</th>
                <th className="px-2 py-2 border border-slate-400/40 w-44 text-left">कॉलमचे नाव (Display Header)</th>
                <th className="px-2 py-2 border border-slate-400/40 w-60 text-left">मुद्दल / ठेव जमा लेजर (Credit Ledger) *</th>
                <th className="px-2 py-2 border border-slate-400/40 w-64 text-left">व्याज / दंडव्याज लेजर (Loan Interest)</th>
                <th className="px-2 py-2 border border-slate-400/40 w-52 text-left">नियम व ऑटो-फिल</th>
                <th className="px-2 py-2 border border-slate-400/40 w-14 text-center">काढा</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    कोणताही कॉलम जोडलेला नाही. "नवीन योजना / कॉलम जोडा" क्लिक करा.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const prinLedger = row.principalOrDepositLedgerID
                    ? ledgersMap.get(row.principalOrDepositLedgerID)
                    : undefined;
                  const prinInvalid =
                    !row.principalOrDepositLedgerID || !isLedgerValidForSlot(prinLedger, row.itemType, 'principal');

                  const intLedger = row.interestLedgerID ? ledgersMap.get(row.interestLedgerID) : undefined;
                  const intInvalid =
                    row.itemType === 'LOAN' &&
                    (!row.interestLedgerID || !isLedgerValidForSlot(intLedger, 'LOAN', 'interest'));

                  const recLedger = row.receivableInterestLedgerID
                    ? ledgersMap.get(row.receivableInterestLedgerID)
                    : undefined;
                  const recInvalid =
                    Boolean(row.receivableInterestLedgerID) &&
                    !isLedgerValidForSlot(recLedger, 'LOAN', 'receivable');

                  const ovdLedger = row.overdueInterestLedgerID
                    ? ledgersMap.get(row.overdueInterestLedgerID)
                    : undefined;
                  const ovdInvalid =
                    Boolean(row.overdueInterestLedgerID) &&
                    !isLedgerValidForSlot(ovdLedger, 'LOAN', 'overdue');

                  return (
                    <tr key={row.clientKey} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                      {/* Sequence */}
                      <td className="px-1.5 py-1.5 border border-slate-200 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="inline-block w-6 font-bold text-primary text-xs">{row.sequenceOrder}</span>
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMove(row.clientKey, -1)}
                              disabled={!canEditSettings || idx === 0}
                              title="वर घ्या"
                              className="p-0.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(row.clientKey, 1)}
                              disabled={!canEditSettings || idx === rows.length - 1}
                              title="खाली घ्या"
                              className="p-0.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown size={11} />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-1.5 py-1.5 border border-slate-200">
                        <select
                          disabled={!canEditSettings}
                          value={row.itemType}
                          onChange={(e) => handleTypeChange(row.clientKey, e.target.value as any)}
                          className="w-full border border-slate-300 rounded px-1.5 py-1 bg-white font-semibold disabled:bg-slate-100"
                        >
                          <option value="LOAN">कर्ज (Loan)</option>
                          <option value="THRIFT_SAVING">संजीवनी / वर्गणी ठेव</option>
                          <option value="DEPOSIT_LEDGER">ठेवीचे लेजर (Deposit Ledger)</option>
                          <option value="RD">आवर्ती ठेव (RD)</option>
                          <option value="PIGMY">पिग्मी / दैनिक ठेव (Pigmy)</option>
                          <option value="SHARE">शेअर्स (Share)</option>
                          <option value="LEDGER_OTHER">इतर सामान्य लेजर</option>
                        </select>
                      </td>

                      {/* Scheme */}
                      <td className="px-1.5 py-1.5 border border-slate-200">
                        {row.itemType === 'LOAN' && (
                          <select
                            disabled={!canEditSettings}
                            value={row.loanRateID ?? ''}
                            onChange={(e) => handleSchemeChange(row.clientKey, String(e.target.value ?? ''))}
                            className={`w-full border rounded px-1.5 py-1 bg-white disabled:bg-slate-100 ${
                              !row.loanRateID ? 'border-red-400 bg-red-50' : 'border-slate-300'
                            }`}
                          >
                            <option value="">-- कर्ज योजना निवडा --</option>
                            {loanRates.map((l) => (
                              <option key={l.loanRateID} value={l.loanRateID}>
                                {l.loanType} ({l.loanCode})
                              </option>
                            ))}
                          </select>
                        )}

                        {row.itemType === 'THRIFT_SAVING' && (
                          <select
                            disabled={!canEditSettings}
                            value={row.savingSchemeID ?? ''}
                            onChange={(e) => handleSchemeChange(row.clientKey, String(e.target.value ?? ''))}
                            className={`w-full border rounded px-1.5 py-1 bg-white disabled:bg-slate-100 ${
                              !row.savingSchemeID ? 'border-red-400 bg-red-50' : 'border-slate-300'
                            }`}
                          >
                            <option value="">-- ठेव योजना निवडा --</option>
                            {savingSchemes.map((s) => (
                              <option key={s.settingID} value={s.settingID}>
                                {s.schemeName} ({s.schemeCode}) - {s.postingFrequency}
                              </option>
                            ))}
                          </select>
                        )}

                        {row.itemType === 'DEPOSIT_LEDGER' && (
                          <SearchableSelect
                            disabled={!canEditSettings}
                            value={row.principalOrDepositLedgerID ?? ''}
                            options={buildDemandLedgerOptions(
                              depositLedgers.length > 0 ? depositLedgers : ledgers,
                              'DEPOSIT_LEDGER',
                              'principal',
                              row.principalOrDepositLedgerID
                            )}
                            onChange={(e) => handleSchemeChange(row.clientKey, String(e.target.value ?? ''))}
                            placeholder="-- ठेवीचे लेजर निवडा --"
                            searchPlaceholder="लेजर नाव, कोड, गट शोधा..."
                            countLabel="ठेव लेजर"
                            minMenuWidth={360}
                            className={`rounded ${!row.principalOrDepositLedgerID ? 'ring-1 ring-red-400 bg-red-50' : ''}`}
                          />
                        )}

                        {row.itemType === 'RD' && (
                          <select
                            disabled={!canEditSettings}
                            value={row.rdSchemeID ?? ''}
                            onChange={(e) => handleSchemeChange(row.clientKey, String(e.target.value ?? ''))}
                            className={`w-full border rounded px-1.5 py-1 bg-white disabled:bg-slate-100 ${
                              !row.rdSchemeID ? 'border-red-400 bg-red-50' : 'border-slate-300'
                            }`}
                          >
                            <option value="">-- RD योजना निवडा --</option>
                            {rdSchemes.map((r) => (
                              <option key={r.rdSchemeID} value={r.rdSchemeID}>
                                {r.schemeName} ({r.durationMonths} महिने)
                              </option>
                            ))}
                          </select>
                        )}

                        {row.itemType === 'PIGMY' && (
                          <select
                            disabled={!canEditSettings}
                            value={row.pigmySchemeID ?? ''}
                            onChange={(e) => handleSchemeChange(row.clientKey, String(e.target.value ?? ''))}
                            className={`w-full border rounded px-1.5 py-1 bg-white disabled:bg-slate-100 ${
                              !row.pigmySchemeID ? 'border-red-400 bg-red-50' : 'border-slate-300'
                            }`}
                          >
                            <option value="">-- पिग्मी योजना निवडा --</option>
                            {pigmySchemes.map((p) => (
                              <option key={p.pigmySchemeID} value={p.pigmySchemeID}>
                                {p.schemeName} ({p.schemeCode}) - {p.interestRate}%
                              </option>
                            ))}
                          </select>
                        )}

                        {row.itemType === 'SHARE' && (
                          <select
                            disabled={!canEditSettings}
                            value={row.shareSchemeId ?? ''}
                            onChange={(e) => handleSchemeChange(row.clientKey, String(e.target.value ?? ''))}
                            className="w-full border border-slate-300 rounded px-1.5 py-1 bg-white disabled:bg-slate-100"
                          >
                            <option value="">-- शेअर योजना (ऐच्छिक) --</option>
                            {shareSchemes.map((s) => (
                              <option key={s.shareSchemeId} value={s.shareSchemeId}>
                                {s.schemeName} (₹{s.shareFaceValue})
                              </option>
                            ))}
                          </select>
                        )}

                        {row.itemType === 'LEDGER_OTHER' && (
                          <span className="text-slate-400 italic">थेट लेजरवर जमा (योजना लागू नाही)</span>
                        )}
                      </td>

                      {/* Header Name */}
                      <td className="px-1.5 py-1.5 border border-slate-200">
                        <input
                          type="text"
                          disabled={!canEditSettings}
                          value={row.columnHeaderMr}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.clientKey === row.clientKey ? { ...r, columnHeaderMr: e.target.value } : r
                              )
                            )
                          }
                          placeholder="उदा. आकस्मिक कर्ज"
                          className={`w-full border rounded px-1.5 py-1 font-medium disabled:bg-slate-100 ${
                            !row.columnHeaderMr.trim() ? 'border-red-400 bg-red-50' : 'border-slate-300'
                          }`}
                        />
                      </td>

                      {/* Principal / Deposit Credit Ledger */}
                      <td className="px-1.5 py-1.5 border border-slate-200">
                        <SearchableSelect
                          disabled={!canEditSettings}
                          value={row.principalOrDepositLedgerID ?? ''}
                          options={buildDemandLedgerOptions(
                            ledgers,
                            row.itemType,
                            'principal',
                            row.principalOrDepositLedgerID
                          )}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.clientKey === row.clientKey
                                  ? {
                                      ...r,
                                      principalOrDepositLedgerID: e.target.value ? Number(e.target.value) : null
                                    }
                                  : r
                              )
                            )
                          }
                          placeholder="-- जमा लेजर शोधा / निवडा * --"
                          searchPlaceholder="लेजर नाव, कोड किंवा ID शोधा..."
                          countLabel="योग्य लेजर"
                          minMenuWidth={380}
                          className={`rounded ${prinInvalid ? 'ring-1 ring-red-400 bg-red-50' : ''}`}
                        />
                      </td>

                      {/* Loan Interest Ledgers (Regular + Receivable + Overdue Penal) */}
                      <td className="px-1.5 py-1.5 border border-slate-200">
                        {row.itemType === 'LOAN' ? (
                          <div className="space-y-1">
                            <SearchableSelect
                              disabled={!canEditSettings}
                              value={row.interestLedgerID ?? ''}
                              options={buildDemandLedgerOptions(
                                ledgers,
                                'LOAN',
                                'interest',
                                row.interestLedgerID
                              )}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.clientKey === row.clientKey
                                      ? { ...r, interestLedgerID: e.target.value ? Number(e.target.value) : null }
                                      : r
                                  )
                                )
                              }
                              placeholder="-- चालू व्याज उत्पन्न लेजर * --"
                              searchPlaceholder="व्याज उत्पन्न लेजर शोधा..."
                              countLabel="उत्पन्न लेजर"
                              minMenuWidth={380}
                              className={`rounded ${intInvalid ? 'ring-1 ring-red-400 bg-red-50' : ''}`}
                            />

                            <SearchableSelect
                              disabled={!canEditSettings}
                              value={row.receivableInterestLedgerID ?? ''}
                              options={buildDemandLedgerOptions(
                                ledgers,
                                'LOAN',
                                'receivable',
                                row.receivableInterestLedgerID,
                                '-- येणे व्याज लेजर नाही (ऐच्छिक) --'
                              )}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.clientKey === row.clientKey
                                      ? {
                                          ...r,
                                          receivableInterestLedgerID: e.target.value ? Number(e.target.value) : null
                                        }
                                      : r
                                  )
                                )
                              }
                              placeholder="-- येणे व्याज लेजर (ऐच्छिक) --"
                              searchPlaceholder="येणे व्याज लेजर शोधा..."
                              countLabel="Assets लेजर"
                              minMenuWidth={380}
                              className={`rounded text-[10px] ${recInvalid ? 'ring-1 ring-red-400 bg-red-50' : ''}`}
                            />

                            <SearchableSelect
                              disabled={!canEditSettings}
                              value={row.overdueInterestLedgerID ?? ''}
                              options={buildDemandLedgerOptions(
                                ledgers,
                                'LOAN',
                                'overdue',
                                row.overdueInterestLedgerID,
                                '-- दंडव्याज लेजर नाही (चालू व्याज लागू) --'
                              )}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.clientKey === row.clientKey
                                      ? {
                                          ...r,
                                          overdueInterestLedgerID: e.target.value ? Number(e.target.value) : null
                                        }
                                      : r
                                  )
                                )
                              }
                              placeholder="-- थकीत दंडव्याज लेजर (ऐच्छिक) --"
                              searchPlaceholder="दंडव्याज उत्पन्न लेजर शोधा..."
                              countLabel="उत्पन्न लेजर"
                              minMenuWidth={380}
                              className={`rounded text-[10px] ${
                                ovdInvalid
                                  ? 'ring-1 ring-red-400 bg-red-50'
                                  : row.includeOverduePenalInterest && !row.overdueInterestLedgerID
                                  ? 'ring-1 ring-amber-400 bg-amber-50/70'
                                  : ''
                              }`}
                            />
                            {ovdInvalid && ovdLedger && (
                              <div className="text-[10px] text-red-700 font-medium leading-tight">
                                ⚠️ '{ovdLedger.ledgerName}' हे '{ovdLedger.natureOfGroup || ovdLedger.accountType}' गटात आहे; दंडव्याजासाठी Income लेजर निवडा किंवा रिकामे ठेवा.
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">फक्त कर्जासाठी लागू</span>
                        )}
                      </td>

                      {/* Rules */}
                      <td className="px-2 py-1.5 border border-slate-200 space-y-1">
                        {row.itemType === 'LOAN' ? (
                          <>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={!canEditSettings}
                                checked={row.showBalanceColumn}
                                onChange={(e) =>
                                  setRows((prev) =>
                                    prev.map((r) =>
                                      r.clientKey === row.clientKey ? { ...r, showBalanceColumn: e.target.checked } : r
                                    )
                                  )
                                }
                              />
                              <span>'बाकी' कॉलम दाखवा</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={!canEditSettings}
                                checked={row.includeOverduePenalInterest}
                                onChange={(e) =>
                                  setRows((prev) =>
                                    prev.map((r) =>
                                      r.clientKey === row.clientKey
                                        ? { ...r, includeOverduePenalInterest: e.target.checked }
                                        : r
                                    )
                                  )
                                }
                              />
                              <span>थकीत दंडव्याज समाविष्ट करा</span>
                            </label>
                            <select
                              disabled={!canEditSettings}
                              value={row.loanIntraAllocationOrder}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.clientKey === row.clientKey
                                      ? { ...r, loanIntraAllocationOrder: e.target.value as any }
                                      : r
                                  )
                                )
                              }
                              className="w-full border border-slate-200 rounded px-1 py-0.5 text-[10px] disabled:bg-slate-100"
                            >
                              <option value="INTEREST_FIRST">वसुली क्रम: आधी व्याज → मुद्दल</option>
                              <option value="PRINCIPAL_FIRST">वसुली क्रम: आधी मुद्दल → व्याज</option>
                            </select>
                          </>
                        ) : (
                          <>
                            {(row.itemType === 'THRIFT_SAVING' ||
                              row.itemType === 'DEPOSIT_LEDGER' ||
                              row.itemType === 'PIGMY' ||
                              row.itemType === 'LEDGER_OTHER') && (
                              <div className="flex items-center justify-between gap-1">
                                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-emerald-800">
                                  <input
                                    type="radio"
                                    name="demandContributionTarget"
                                    disabled={!canEditSettings}
                                    checked={row.isContributionTarget}
                                    onChange={() => handleContributionTargetSelect(row.clientKey)}
                                  />
                                  <span>'वर्गणी ठेव' लक्ष्य</span>
                                </label>
                                {row.isContributionTarget && canEditSettings && (
                                  <button
                                    type="button"
                                    onClick={() => handleContributionTargetSelect(null)}
                                    className="text-[9px] text-slate-500 hover:text-red-600 underline cursor-pointer"
                                  >
                                    काढा
                                  </button>
                                )}
                              </div>
                            )}
                            {row.itemType === 'RD' && (
                              <div className="text-[10px] text-blue-700 font-medium">
                                &gt; १ RD असल्यास फॉर्मवर खाली उप-ओळ तयार होईल
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-600">डिफॉल्ट ₹:</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                disabled={!canEditSettings}
                                placeholder="0"
                                value={row.defaultAmountDraft}
                                onChange={(e) => handleDefaultAmountDraftChange(row.clientKey, e.target.value)}
                                onBlur={() => handleDefaultAmountBlur(row.clientKey)}
                                className="w-20 border border-slate-300 rounded px-1 py-0.5 text-right font-mono disabled:bg-slate-100"
                              />
                            </div>
                          </>
                        )}
                      </td>

                      {/* Remove */}
                      <td className="px-1.5 py-1.5 border border-slate-200 text-center">
                        <button
                          type="button"
                          disabled={!canEditSettings}
                          onClick={() => handleRemoveRow(row)}
                          title="काढून टाका"
                          className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer disabled:opacity-30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
