import { SearchableSelectOption } from '../components/SearchableSelect';

export interface BankLedgerOption {
  ledgerID?: number;
  LedgerID?: number;
  ledgerName?: string;
  LedgerName?: string;
  ledgerNameEnglish?: string;
  LedgerNameEnglish?: string;
  ledgerCode?: string;
  LedgerCode?: string;
  accountType?: string;
  AccountType?: string;
  groupID?: number;
  groupName?: string;
  isActive?: boolean;
  IsActive?: boolean;
  accountGroup?: {
    groupID?: number;
    groupCode?: string;
    groupName?: string;
    GroupName?: string;
    groupNameEnglish?: string;
    GroupNameEnglish?: string;
    natureOfGroup?: string;
    NatureOfGroup?: string;
  };
  AccountGroup?: {
    groupID?: number;
    groupCode?: string;
    groupName?: string;
    GroupName?: string;
    groupNameEnglish?: string;
    GroupNameEnglish?: string;
    natureOfGroup?: string;
    NatureOfGroup?: string;
  };
  [key: string]: any;
}

export interface RawLedgerItem extends BankLedgerOption {
  ledgerID: number;
  ledgerName: string;
}

export function getLedgerId(ledger: BankLedgerOption | null | undefined): number {
  if (!ledger) return 0;
  return Number(ledger.ledgerID ?? ledger.LedgerID ?? 0) || 0;
}

export function getLedgerName(ledger: BankLedgerOption | null | undefined): string {
  if (!ledger) return '';
  return String(ledger.ledgerName ?? ledger.LedgerName ?? '').trim();
}

export function getLedgerCode(ledger: BankLedgerOption | null | undefined): string {
  if (!ledger) return '';
  return String(ledger.ledgerCode ?? ledger.LedgerCode ?? '').trim();
}

export function isBankPaymentMode(paymentMode?: string | null): boolean {
  if (!paymentMode) return false;
  const normalized = paymentMode.trim().toLowerCase();
  return (
    normalized === 'bank' ||
    normalized === 'bank account' ||
    normalized === 'banktransfer' ||
    normalized === 'bank transfer' ||
    normalized === 'bank_transfer' ||
    normalized === 'cheque' ||
    normalized === 'online' ||
    normalized === 'upi' ||
    normalized === 'neft' ||
    normalized === 'rtgs' ||
    normalized === 'imps' ||
    normalized === 'dd' ||
    normalized === 'demand draft' ||
    normalized === 'demand_draft' ||
    normalized === 'card'
  );
}

export function isCashLedgerOption(ledger: BankLedgerOption | null | undefined): boolean {
  if (!ledger) return false;
  const rawType = String(ledger.accountType ?? ledger.AccountType ?? '').trim().toLowerCase();
  if (rawType === 'cash' || rawType === 'cash in hand' || rawType === 'रोख खाते') {
    return true;
  }

  const name = getLedgerName(ledger);
  const nameLower = name.toLowerCase();
  const hasBankWord =
    name.includes('बँक') ||
    nameLower.includes('bank') ||
    nameLower.includes('dccb') ||
    nameLower.includes('od ') ||
    nameLower.includes('cc ');

  if (hasBankWord && !name.includes('हातातील') && !name.includes('हातावरील') && !nameLower.includes('cash in hand')) {
    return false;
  }

  return (
    name.includes('हातातील रोख') ||
    name.includes('हातावरील रोख') ||
    name.includes('हाता. रोख') ||
    name.includes('रोख शिल्लक') ||
    name === 'रोख खाते' ||
    nameLower === 'cash' ||
    nameLower.includes('cash in hand') ||
    nameLower.includes('petty cash') ||
    ((name.includes('रोख') || nameLower.includes('cash')) && !hasBankWord)
  );
}

/**
 * Checks whether a ledger is an active Bank GL ledger:
 * 1) Explicit AccountType === 'Bank Account' / 'Bank' / 'Current Account' / 'OD Account' / 'CC Account'
 * 2) Or generic AccountType ('GL' / 'Assets' / '') placed under a Bank AccountGroup (excluding Cash ledgers).
 */
export function isBankAccountLedger(ledger: BankLedgerOption | null | undefined): boolean {
  if (!ledger) return false;

  const isActive = ledger.isActive ?? ledger.IsActive ?? true;
  if (isActive === false) return false;

  if (isCashLedgerOption(ledger)) return false;

  const rawType = String(ledger.accountType ?? ledger.AccountType ?? '').trim().toLowerCase();
  if (
    rawType === 'bank account' ||
    rawType === 'bank' ||
    rawType === 'बँक खाते' ||
    rawType === 'बँक' ||
    rawType === 'current account' ||
    rawType === 'od account' ||
    rawType === 'cc account'
  ) {
    return true;
  }

  const isGenericType =
    rawType === '' ||
    rawType === 'gl' ||
    rawType === 'assets' ||
    rawType === 'asset' ||
    rawType === 'liabilities';

  if (!isGenericType) return false;

  const grp = ledger.accountGroup ?? ledger.AccountGroup;
  const groupName = `${grp?.groupName ?? grp?.GroupName ?? ''} ${grp?.groupNameEnglish ?? grp?.GroupNameEnglish ?? ''}`.trim();
  const groupLower = groupName.toLowerCase();
  const ledgerFull = `${getLedgerName(ledger)} ${ledger.ledgerNameEnglish ?? ledger.LedgerNameEnglish ?? ''}`.trim();
  const ledgerLower = ledgerFull.toLowerCase();

  const isNonBankGroup =
    groupName.includes('कर्ज') ||
    groupLower.includes('loan') ||
    groupName.includes('गुंतवणूक') ||
    groupLower.includes('investment') ||
    groupName.includes('मुदत') ||
    groupName.includes('आवर्ती') ||
    groupName.includes('पिग्मी') ||
    groupName.includes('बचत ठेव') ||
    groupLower.includes('deposit') ||
    groupName.includes('व्याज') ||
    groupLower.includes('interest') ||
    groupName.includes('भांडवल') ||
    groupLower.includes('capital') ||
    groupLower.includes('share') ||
    groupName.includes('उत्पन्न') ||
    groupLower.includes('income') ||
    groupName.includes('खर्च') ||
    groupLower.includes('expense');

  if (isNonBankGroup) return false;

  const groupHasBank =
    groupName.includes('बँक') ||
    groupLower.includes('bank') ||
    groupName.includes('चालू खात') ||
    groupLower.includes('current account') ||
    groupLower.includes('overdraft') ||
    groupLower.includes('od/cc') ||
    groupLower.includes('dccb');
  const groupHasCash = groupName.includes('रोख') || groupLower.includes('cash');

  if (groupHasBank && !groupHasCash) return true;

  if (groupHasBank && groupHasCash) {
    const ledgerHasBank =
      ledgerFull.includes('बँक') ||
      ledgerLower.includes('bank') ||
      ledgerLower.includes('dccb') ||
      ledgerLower.includes('sbi') ||
      ledgerLower.includes('hdfc') ||
      ledgerLower.includes('icici') ||
      ledgerLower.includes('axis') ||
      ledgerLower.includes('maharashtra') ||
      ledgerFull.includes('चालू') ||
      ledgerLower.includes('current') ||
      ledgerLower.includes('od') ||
      ledgerLower.includes('cc');
    const ledgerHasCash =
      ledgerFull.includes('रोख') || ledgerFull.includes('हात') || ledgerLower.includes('cash');
    return ledgerHasBank && !ledgerHasCash;
  }

  return false;
}

/**
 * Filters a list of ledgers down to active Bank GL ledgers sorted ascending by LedgerID.
 */
export function filterBankLedgers<T extends BankLedgerOption>(ledgers: T[] | null | undefined): T[] {
  if (!Array.isArray(ledgers)) return [];
  return ledgers
    .filter((l) => isBankAccountLedger(l))
    .sort((a, b) => getLedgerId(a) - getLedgerId(b));
}

export const filterBankAccountLedgers = <T extends BankLedgerOption = RawLedgerItem>(allLedgers: T[] | null | undefined): T[] =>
  filterBankLedgers(allLedgers);

export const isBankLedger = isBankAccountLedger;

export function formatBankLedgerLabel(ledger: BankLedgerOption | null | undefined): string {
  if (!ledger) return '';
  const id = getLedgerId(ledger);
  const code = getLedgerCode(ledger);
  const name = getLedgerName(ledger);
  if (code) return `[${code}] ${name}`;
  if (id > 0) return `${id} - ${name}`;
  return name;
}

/**
 * Builds SearchableSelect options formatted as "${ledgerID} - ${ledgerName}"
 * so operators can search by Ledger ID (English or Marathi digits) as well as Ledger Name.
 */
export const buildBankLedgerOptions = (
  bankLedgers: BankLedgerOption[],
  selectedLedgerId?: number | string | null,
  allLedgersForFallback?: BankLedgerOption[]
): SearchableSelectOption[] => {
  let effectiveList = Array.isArray(bankLedgers) ? bankLedgers : [];
  const selNum = Number(selectedLedgerId || 0);

  if (
    selNum > 0 &&
    !effectiveList.some((b) => getLedgerId(b) === selNum) &&
    Array.isArray(allLedgersForFallback)
  ) {
    const fallbackLedger = allLedgersForFallback.find((l) => getLedgerId(l) === selNum);
    if (fallbackLedger) {
      effectiveList = [fallbackLedger, ...effectiveList];
    }
  }

  return effectiveList.map((bl) => {
    const id = getLedgerId(bl);
    const name = getLedgerName(bl);
    const engRaw = bl.ledgerNameEnglish ?? bl.LedgerNameEnglish;
    const engPart = engRaw ? ` (${engRaw})` : '';
    const grp = bl.accountGroup ?? bl.AccountGroup;
    const grpNameVal = grp?.groupName ?? grp?.GroupName;
    const grpName = grpNameVal
      ? `गट: ${grp?.groupCode ? `[${grp.groupCode}] ` : ''}${grpNameVal}`
      : bl.groupName
        ? `गट: ${bl.groupName}`
        : 'खाते प्रकार: Bank Account (बँक खाते)';

    return {
      value: id,
      label: `${id} - ${name}${engPart}`,
      subLabel: grpName,
      badge: `खाते क्र.: ${id}`,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
    };
  });
};
