import { SearchableSelectOption } from '../components/SearchableSelect';

export interface RawLedgerItem {
  ledgerID: number;
  ledgerCode?: string;
  ledgerName: string;
  ledgerNameEnglish?: string;
  accountType?: string;
  groupID?: number;
  groupName?: string;
  isActive?: boolean;
  accountGroup?: {
    groupID?: number;
    groupName?: string;
    groupCode?: string;
  };
}

/**
 * Checks whether a ledger is an active Bank Account ledger as configured in Ledger Master
 * ('खाते प्रकार (Account Type) *' = 'Bank Account' or legacy 'Bank').
 * Zero hardcoded GroupIDs or name keywords.
 */
export const isBankAccountLedger = (l: any): boolean => {
  if (!l || l.isActive === false) return false;
  const type = String(l.accountType ?? l.AccountType ?? '').trim().toLowerCase();
  return type === 'bank account' || type === 'bank';
};

/**
 * Strictly filters active Bank Account ledgers sorted ascending by LedgerID.
 * Never falls back to allLedgers.
 */
export const filterBankAccountLedgers = <T extends RawLedgerItem = RawLedgerItem>(allLedgers: T[]): T[] => {
  if (!Array.isArray(allLedgers)) return [];
  return allLedgers
    .filter((l) => isBankAccountLedger(l))
    .sort((a, b) => Number(a.ledgerID) - Number(b.ledgerID));
};

/**
 * Builds SearchableSelect options formatted as "${ledgerID} - ${ledgerName}"
 * so operators can search by Ledger ID (English or Marathi digits) as well as Ledger Name.
 */
export const buildBankLedgerOptions = (
  bankLedgers: RawLedgerItem[],
  selectedLedgerId?: number | string | null,
  allLedgersForFallback?: RawLedgerItem[]
): SearchableSelectOption[] => {
  let effectiveList = Array.isArray(bankLedgers) ? bankLedgers : [];
  const selNum = Number(selectedLedgerId || 0);

  if (
    selNum > 0 &&
    !effectiveList.some((b) => Number(b.ledgerID) === selNum) &&
    Array.isArray(allLedgersForFallback)
  ) {
    const fallbackLedger = allLedgersForFallback.find((l) => Number(l.ledgerID) === selNum);
    if (fallbackLedger) {
      effectiveList = [fallbackLedger, ...effectiveList];
    }
  }

  return effectiveList.map((bl) => {
    const engPart = bl.ledgerNameEnglish ? ` (${bl.ledgerNameEnglish})` : '';
    const grpName = bl.accountGroup?.groupName
      ? `गट: ${bl.accountGroup.groupCode ? `[${bl.accountGroup.groupCode}] ` : ''}${bl.accountGroup.groupName}`
      : bl.groupName
        ? `गट: ${bl.groupName}`
        : 'खाते प्रकार: Bank Account (बँक खाते)';

    return {
      value: bl.ledgerID,
      label: `${bl.ledgerID} - ${bl.ledgerName}${engPart}`,
      subLabel: grpName,
      badge: `खाते क्र.: ${bl.ledgerID}`,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
    };
  });
};

