import React from 'react';
import AuroraHubLayout, { AuroraHubActionItem } from './common/AuroraHubLayout';
import {
  AnimatedDepositIcon,
  AnimatedAccountCloseIcon,
  AnimatedInterestIcon,
  AnimatedReportsIcon,
} from './common/AnimatedDashboardIcons';

interface FdRdDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function FdRdDashboard({ onNavigate }: FdRdDashboardProps) {
  const fdActionButtons: AuroraHubActionItem[] = [
    {
      id: 'fd-open',
      titleMr: 'नवीन मुदत ठेव',
      titleEn: 'FD ACCOUNT',
      subtitleMr: 'नवीन मुदत ठेव पावती व नोंदणी',
      icon: AnimatedDepositIcon,
      tab: 'fd-account',
      params: {},
      gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 55%, #15803D 100%)',
      shadowColor: 'rgba(34, 197, 94, 0.38)',
      accentHex: '#16A34A',
    },
    {
      id: 'fd-withdraw',
      titleMr: 'मुदत ठेव परतावा',
      titleEn: 'FD MATURITY',
      subtitleMr: 'नूतनीकरण व मुदतपूर्व परतावा',
      icon: AnimatedAccountCloseIcon,
      tab: 'fd-withdrawal',
      params: {},
      gradient: 'linear-gradient(135deg, #38BDF8 0%, #1D8CF8 55%, #1D4ED8 100%)',
      shadowColor: 'rgba(29, 140, 248, 0.40)',
      accentHex: '#1D74F5',
    },
    {
      id: 'fd-accrual',
      titleMr: 'FD व्याज आकारणी',
      titleEn: 'FD ACCRUAL',
      subtitleMr: 'मुदत ठेव व्याज तरतूद व MIS',
      icon: AnimatedInterestIcon,
      tab: 'fd-accrual',
      params: {},
      gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 55%, #D97706 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.40)',
      accentHex: '#D97706',
    },
    {
      id: 'fd-reports',
      titleMr: 'मुदत ठेव अहवाल',
      titleEn: 'REPORTS',
      subtitleMr: 'नोंदवही, बाकी व मुदतपूर्ती अहवाल',
      icon: AnimatedReportsIcon,
      tab: 'fd-reports',
      params: {},
      gradient: 'linear-gradient(135deg, #22D3EE 0%, #0891B2 55%, #0369A1 100%)',
      shadowColor: 'rgba(8, 145, 178, 0.38)',
      accentHex: '#0E7490',
    },
  ];

  return (
    <AuroraHubLayout
      badgeLabel="FIXED DEPOSIT CORE HUB"
      titleMr="मुदत ठेव विभाग मुख्य हब"
      subtitleMr="नवीन मुदत ठेव नोंदणी • नूतनीकरण व परतावा • व्याज तरतूद व अहवाल व्यवस्थापन"
      heroIcon={AnimatedDepositIcon}
      heroEmblemGradient="linear-gradient(135deg, #4ADE80 0%, #22C55E 52%, #15803D 100%)"
      heroGlowGradient="linear-gradient(135deg, #22C55E 0%, #06B6D4 55%, #2563EB 100%)"
      underlineGradient="linear-gradient(90deg, #22C55E 0%, #06B6D4 50%, #2563EB 100%)"
      accentSparkleColor="#22C55E"
      items={fdActionButtons}
      onNavigate={onNavigate}
    />
  );
}
