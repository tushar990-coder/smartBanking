import React from 'react';
import BorrowingDashboard from './BorrowingDashboard';

interface BankBorrowingMasterProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function BankBorrowingMaster({ onNavigate }: BankBorrowingMasterProps = {}) {
  return <BorrowingDashboard onNavigate={onNavigate} />;
}
