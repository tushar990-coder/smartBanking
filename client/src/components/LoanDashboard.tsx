import React from 'react';
import AuroraHubLayout, { AuroraHubActionItem } from './common/AuroraHubLayout';
import {
  AnimatedLoanIcon,
  AnimatedLoanCollectionIcon,
  AnimatedGoldLoanIcon,
  AnimatedInterestIcon,
  AnimatedBulkChargesIcon,
  AnimatedApprovalIcon,
  AnimatedBorrowingIcon,
  AnimatedReportsIcon,
} from './common/AnimatedDashboardIcons';

interface LoanDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function LoanDashboard({ onNavigate }: LoanDashboardProps) {
  // 8 Bespoke Animated Glossy Gradient Action Icons for Loan Department (कर्ज विभाग मुख्य हब)
  const loanActionButtons: AuroraHubActionItem[] = [
    {
      id: 'loan-process',
      titleMr: 'कर्ज मागणी व वितरण',
      titleEn: 'DISBURSEMENT',
      subtitleMr: 'नवीन अर्ज, मंजुरी व वाटप',
      icon: AnimatedLoanIcon,
      tab: 'loan-process',
      params: { subTab: 1 },
      gradient: 'linear-gradient(135deg, #EA580C 0%, #B44814 55%, #7C2418 100%)',
      shadowColor: 'rgba(180, 72, 20, 0.38)',
      accentHex: '#9A3412',
    },
    {
      id: 'loan-collection',
      titleMr: 'कर्ज हप्ता वसुली',
      titleEn: 'COLLECTION',
      subtitleMr: 'मुद्दल व व्याज वसुली',
      icon: AnimatedLoanCollectionIcon,
      tab: 'loan-collection',
      params: {},
      gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 55%, #15803D 100%)',
      shadowColor: 'rgba(34, 197, 94, 0.36)',
      accentHex: '#16A34A',
    },
    {
      id: 'gold-loan',
      titleMr: 'सोने तारण कर्ज',
      titleEn: 'GOLD LOAN',
      subtitleMr: 'दागिने मूल्यांकन व तारण',
      icon: AnimatedGoldLoanIcon,
      tab: 'gold-loan-details',
      params: {},
      gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 55%, #D97706 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.38)',
      accentHex: '#D97706',
    },
    {
      id: 'loan-interest',
      titleMr: 'कर्ज व्याज आकारणी',
      titleEn: 'INTEREST',
      subtitleMr: 'मासिक / त्रैमासिक व्याज',
      icon: AnimatedInterestIcon,
      tab: 'loan-interest-posting',
      params: {},
      gradient: 'linear-gradient(135deg, #C084FC 0%, #9333EA 55%, #6B21A8 100%)',
      shadowColor: 'rgba(147, 51, 234, 0.36)',
      accentHex: '#7E22CE',
    },
    {
      id: 'loan-bulk-charges',
      titleMr: 'वसुली खर्च नावे',
      titleEn: 'DUE CHARGES',
      subtitleMr: 'नोटीस व इतर खर्च नावे',
      icon: AnimatedBulkChargesIcon,
      tab: 'loan-bulk-charges',
      params: {},
      gradient: 'linear-gradient(135deg, #FB7185 0%, #E11D48 55%, #9F1239 100%)',
      shadowColor: 'rgba(225, 29, 72, 0.36)',
      accentHex: '#BE123C',
    },
    {
      id: 'loan-docs',
      titleMr: 'तारण व दागिने',
      titleEn: 'COLLATERAL',
      subtitleMr: 'दस्तऐवज व सुरक्षितता',
      icon: AnimatedApprovalIcon,
      tab: 'loan-documents',
      params: {},
      gradient: 'linear-gradient(135deg, #34D399 0%, #10B981 55%, #047857 100%)',
      shadowColor: 'rgba(16, 185, 129, 0.36)',
      accentHex: '#059669',
    },
    {
      id: 'bank-borrowing',
      titleMr: 'बाह्य कर्जे / पुनर्गहाण',
      titleEn: 'BORROWINGS',
      subtitleMr: 'जिल्हा बँक व पुनर्गहाण',
      icon: AnimatedBorrowingIcon,
      tab: 'bank-borrowing',
      params: {},
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #B45309 55%, #78350F 100%)',
      shadowColor: 'rgba(180, 83, 9, 0.38)',
      accentHex: '#B45309',
    },
    {
      id: 'loan-reports',
      titleMr: 'कर्ज अहवाल',
      titleEn: 'REPORTS',
      subtitleMr: 'खतावणी व थकबाकी अहवाल',
      icon: AnimatedReportsIcon,
      tab: 'loan-ledger-report',
      params: {},
      gradient: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 55%, #0F766E 100%)',
      shadowColor: 'rgba(13, 148, 136, 0.36)',
      accentHex: '#0F766E',
    },
  ];

  return (
    <AuroraHubLayout
      badgeLabel="LOAN DEPARTMENT CORE HUB"
      titleMr="कर्ज विभाग मुख्य हब"
      subtitleMr="कर्ज मागणी व वितरण • हप्ता वसुली • सोने तारण • व्याज आकारणी • बाह्य कर्जे व अहवाल"
      heroIcon={AnimatedLoanIcon}
      heroEmblemGradient="linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)"
      heroGlowGradient="linear-gradient(135deg, #8C2D19 0%, #D97706 60%, #F59E0B 100%)"
      underlineGradient="linear-gradient(90deg, #7C2418 0%, #D97706 55%, #F59E0B 100%)"
      accentSparkleColor="#D97706"
      items={loanActionButtons}
      onNavigate={onNavigate}
    />
  );
}
