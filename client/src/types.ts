export interface Member {
  memberID: number;
  memberCode: string;
  firstName: string;
  lastName: string;
  mobileNo: string;
}

export interface SavingAccount {
  savingAccountID: number;
  accountNo: string;
  memberID: number;
  memberName?: string;
  openingDate: string;
  openingBalance: number;
  currentBalance: number;
  interestRate: number;
  minimumBalance: number;
  oldAccountNo?: string;
  legacyAccountNumber?: string;
  lastInterestPostingDate?: string;
  lastInterestAmount?: number;
  status: string;
}

export interface SavingTransaction {
  transactionID: number;
  savingAccountID: number;
  transactionDate: string;
  transactionType: string;
  paymentMode: string;
  amount: number;
  balanceAfterTxn: number;
  narration?: string;
  voucherNo?: string;
}
