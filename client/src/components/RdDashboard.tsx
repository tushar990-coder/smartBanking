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
      gradient: 'linear-gradient(135deg, #EA580C 0%, #B44814 55%, #7C2418 100%)',
      shadowColor: 'rgba(180, 72, 20, 0.38)',
      accentHex: '#9A3412',
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
      gradient: 'linear-gradient(135deg, #FB7185 0%, #E11D48 55%, #9F1239 100%)',
      shadowColor: 'rgba(225, 29, 72, 0.36)',
      accentHex: '#BE123C',
    },
    {
      id: 'rd-reports',
      titleMr: 'आवर्ती अहवाल',
      titleEn: 'REPORTS',
      subtitleMr: 'नोंदवही, थकीत यादी व खतावणी',
      icon: AnimatedReportsIcon,
      tab: 'rd-reports',
      params: {},
      gradient: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 55%, #0F766E 100%)',
      shadowColor: 'rgba(13, 148, 136, 0.36)',
      accentHex: '#0F766E',
    },
  ];

  return (
    <AuroraHubLayout
      badgeLabel="RECURRING DEPOSIT CORE HUB"
      titleMr="आवर्ती ठेव विभाग मुख्य हब"
      subtitleMr="नवीन आवर्ती ठेव नोंदणी • मासिक हप्ता वसुली • व्याज आकारणी • मुदतपूर्ती परतावा व अहवाल"
      heroIcon={AnimatedLoanCollectionIcon}
      heroEmblemGradient="linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)"
      heroGlowGradient="linear-gradient(135deg, #8C2D19 0%, #D97706 60%, #F59E0B 100%)"
      underlineGradient="linear-gradient(90deg, #7C2418 0%, #D97706 55%, #F59E0B 100%)"
      accentSparkleColor="#D97706"
      items={rdActionButtons}
      onNavigate={onNavigate}
    />
  );
}
