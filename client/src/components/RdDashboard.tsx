import React from 'react';
import AuroraHubLayout, { AuroraHubActionItem } from './common/AuroraHubLayout';
import {
  AnimatedSavingIcon,
  AnimatedLoanCollectionIcon,
  AnimatedInterestIcon,
  AnimatedAccountCloseIcon,
  AnimatedReportsIcon,
} from './common/AnimatedDashboardIcons';

interface RdDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function RdDashboard({ onNavigate }: RdDashboardProps) {
  const rdActionButtons: AuroraHubActionItem[] = [
    {
      id: 'rd-open',
      titleMr: 'नवीन आवर्ती ठेव',
      titleEn: 'RD ACCOUNT',
      subtitleMr: 'नवीन आरडी खाते व मासिक हप्ता योजना',
      icon: AnimatedSavingIcon,
      tab: 'rd-account',
      params: {},
      gradient: 'linear-gradient(135deg, #38BDF8 0%, #1D8CF8 55%, #1D4ED8 100%)',
      shadowColor: 'rgba(29, 140, 248, 0.40)',
      accentHex: '#1D74F5',
    },
    {
      id: 'rd-collect',
      titleMr: 'आवर्ती हप्ता वसुली',
      titleEn: 'COLLECTION',
      subtitleMr: 'मासिक हप्ता संकलन व पावती',
      icon: AnimatedLoanCollectionIcon,
      tab: 'rd-collect',
      params: {},
      gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 55%, #15803D 100%)',
      shadowColor: 'rgba(34, 197, 94, 0.38)',
      accentHex: '#16A34A',
    },
    {
      id: 'rd-accrual',
      titleMr: 'आवर्ती व्याज आकारणी',
      titleEn: 'ACCRUAL',
      subtitleMr: 'आरडी व्याज तरतूद पोस्टिंग',
      icon: AnimatedInterestIcon,
      tab: 'rd-accrual',
      params: {},
      gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 55%, #D97706 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.40)',
      accentHex: '#D97706',
    },
    {
      id: 'rd-withdraw',
      titleMr: 'आवर्ती ठेव परतावा',
      titleEn: 'MATURITY',
      subtitleMr: 'मुदतपूर्ती व मुदतपूर्व खाते बंद',
      icon: AnimatedAccountCloseIcon,
      tab: 'rd-withdrawal',
      params: {},
      gradient: 'linear-gradient(135deg, #C084FC 0%, #9333EA 55%, #6B21A8 100%)',
      shadowColor: 'rgba(147, 51, 234, 0.38)',
      accentHex: '#7E22CE',
    },
    {
      id: 'rd-reports',
      titleMr: 'आवर्ती अहवाल',
      titleEn: 'REPORTS',
      subtitleMr: 'नोंदवही, थकीत यादी व खतावणी',
      icon: AnimatedReportsIcon,
      tab: 'rd-reports',
      params: {},
      gradient: 'linear-gradient(135deg, #22D3EE 0%, #0891B2 55%, #0369A1 100%)',
      shadowColor: 'rgba(8, 145, 178, 0.38)',
      accentHex: '#0E7490',
    },
  ];

  return (
    <AuroraHubLayout
      badgeLabel="RECURRING DEPOSIT CORE HUB"
      titleMr="आवर्ती ठेव विभाग मुख्य हब"
      subtitleMr="नवीन आवर्ती ठेव नोंदणी • मासिक हप्ता वसुली • व्याज आकारणी • मुदतपूर्ती परतावा व अहवाल"
      heroIcon={AnimatedLoanCollectionIcon}
      heroEmblemGradient="linear-gradient(135deg, #FBBF24 0%, #F59E0B 52%, #D97706 100%)"
      heroGlowGradient="linear-gradient(135deg, #F59E0B 0%, #22C55E 55%, #2563EB 100%)"
      underlineGradient="linear-gradient(90deg, #F59E0B 0%, #22C55E 50%, #0891B2 100%)"
      accentSparkleColor="#F59E0B"
      items={rdActionButtons}
      onNavigate={onNavigate}
    />
  );
}
