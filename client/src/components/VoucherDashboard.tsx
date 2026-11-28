import React from 'react';
import AuroraHubLayout, { AuroraHubActionItem } from './common/AuroraHubLayout';
import {
  AnimatedTransferIcon,
  AnimatedLoanCollectionIcon,
  AnimatedDepositIcon,
  AnimatedJournalIcon,
  AnimatedApprovalIcon,
  AnimatedPassbookIcon,
} from './common/AnimatedDashboardIcons';

interface VoucherDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function VoucherDashboard({ onNavigate }: VoucherDashboardProps) {
  const voucherActionButtons: AuroraHubActionItem[] = [
    {
      id: 'voucher-receipt',
      titleMr: 'रोख जमा पावती',
      titleEn: 'CASH RECEIPT',
      subtitleMr: 'रोख जमा पावती व्हाऊचर नोंदणी',
      icon: AnimatedLoanCollectionIcon,
      tab: 'voucher',
      params: { type: 'receipt' },
      gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 55%, #15803D 100%)',
      shadowColor: 'rgba(34, 197, 94, 0.38)',
      accentHex: '#16A34A',
    },
    {
      id: 'voucher-payment',
      titleMr: 'रोख नावे पेमेंट',
      titleEn: 'CASH PAYMENT',
      subtitleMr: 'रोख पेमेंट व्हाऊचर नोंदणी',
      icon: AnimatedDepositIcon,
      tab: 'voucher',
      params: { type: 'payment' },
      gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 55%, #D97706 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.40)',
      accentHex: '#D97706',
    },
    {
      id: 'voucher-journal',
      titleMr: 'जर्नल व्हाऊचर',
      titleEn: 'JOURNAL',
      subtitleMr: 'ट्रान्सफर व समायोजन नोंदी',
      icon: AnimatedJournalIcon,
      tab: 'voucher',
      params: { type: 'journal' },
      gradient: 'linear-gradient(135deg, #C084FC 0%, #9333EA 55%, #6B21A8 100%)',
      shadowColor: 'rgba(147, 51, 234, 0.38)',
      accentHex: '#7E22CE',
    },
    {
      id: 'voucher-posting',
      titleMr: 'व्हाऊचर मंजुरी',
      titleEn: 'POSTING',
      subtitleMr: 'मेकर-चेकर पासिंग व अन-पास',
      icon: AnimatedApprovalIcon,
      tab: 'voucher-posting',
      params: {},
      gradient: 'linear-gradient(135deg, #34D399 0%, #10B981 55%, #047857 100%)',
      shadowColor: 'rgba(16, 185, 129, 0.38)',
      accentHex: '#059669',
    },
    {
      id: 'voucher-batch-print',
      titleMr: 'बॅच प्रिंटिंग',
      titleEn: 'BATCH PRINT',
      subtitleMr: 'एकत्रित व्हाऊचर पावत्या प्रिंट',
      icon: AnimatedPassbookIcon,
      tab: 'voucher-batch-print',
      params: {},
      gradient: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 55%, #0F766E 100%)',
      shadowColor: 'rgba(13, 148, 136, 0.36)',
      accentHex: '#0F766E',
    },
  ];

  return (
    <AuroraHubLayout
      badgeLabel="VOUCHERS & ACCOUNTS CORE HUB"
      titleMr="व्हाऊचर्स व रोख हिशोब मुख्य हब"
      subtitleMr="रोख जमा पावती • पेमेंट व्हाऊचर • जर्नल नोंदी • व्हाऊचर पासिंग व बॅच प्रिंटिंग व्यवस्थापन"
      heroIcon={AnimatedTransferIcon}
      heroEmblemGradient="linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)"
      heroGlowGradient="linear-gradient(135deg, #8C2D19 0%, #D97706 60%, #F59E0B 100%)"
      underlineGradient="linear-gradient(90deg, #7C2418 0%, #D97706 55%, #F59E0B 100%)"
      accentSparkleColor="#D97706"
      items={voucherActionButtons}
      onNavigate={onNavigate}
    />
  );
}
