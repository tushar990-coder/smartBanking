import React from 'react';
import AuroraHubLayout, { AuroraHubActionItem } from './common/AuroraHubLayout';
import {
  AnimatedCustomerIcon,
  AnimatedSavingIcon,
  AnimatedLoanCollectionIcon,
  AnimatedJournalIcon,
  AnimatedLoanIcon,
  AnimatedInterestIcon,
  AnimatedAccountCloseIcon,
} from './common/AnimatedDashboardIcons';

interface PigmyDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function PigmyDashboard({ onNavigate }: PigmyDashboardProps) {
  const pigmyActionButtons: AuroraHubActionItem[] = [
    {
      id: 'pigmy-agent',
      titleMr: 'पिग्मी एजंट नोंदणी',
      titleEn: 'AGENT MASTER',
      subtitleMr: 'एजंट मास्टर व कमिशन दर',
      icon: AnimatedCustomerIcon,
      tab: 'pigmy-agent',
      params: {},
      gradient: 'linear-gradient(135deg, #38BDF8 0%, #1D8CF8 55%, #1D4ED8 100%)',
      shadowColor: 'rgba(29, 140, 248, 0.40)',
      accentHex: '#1D74F5',
    },
    {
      id: 'pigmy-account',
      titleMr: 'पिग्मी खाते उघडणे',
      titleEn: 'OPEN ACCOUNT',
      subtitleMr: 'नवीन पिग्मी ठेव खाते नोंदणी',
      icon: AnimatedSavingIcon,
      tab: 'pigmy-account',
      params: {},
      gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 55%, #15803D 100%)',
      shadowColor: 'rgba(34, 197, 94, 0.38)',
      accentHex: '#16A34A',
    },
    {
      id: 'pigmy-collection',
      titleMr: 'पिग्मी दैनंदिन वसुली',
      titleEn: 'COLLECTION',
      subtitleMr: 'दैनंदिन पिग्मी संकलन नोंद',
      icon: AnimatedLoanCollectionIcon,
      tab: 'pigmy-collection',
      params: {},
      gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 55%, #D97706 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.40)',
      accentHex: '#D97706',
    },
    {
      id: 'pigmy-daybook',
      titleMr: 'एजंट डे-बुक नोंद',
      titleEn: 'AGENT DAYBOOK',
      subtitleMr: 'एजंटनिहाय रोख ताळमेळ',
      icon: AnimatedJournalIcon,
      tab: 'pigmy-daybook',
      params: {},
      gradient: 'linear-gradient(135deg, #C084FC 0%, #9333EA 55%, #6B21A8 100%)',
      shadowColor: 'rgba(147, 51, 234, 0.38)',
      accentHex: '#7E22CE',
    },
    {
      id: 'pigmy-commission',
      titleMr: 'एजंट कमिशन वाटप',
      titleEn: 'COMMISSION',
      subtitleMr: 'मासिक एजंट कमिशन व TDS',
      icon: AnimatedLoanIcon,
      tab: 'pigmy-commission',
      params: {},
      gradient: 'linear-gradient(135deg, #60A5FA 0%, #2563EB 55%, #1E40AF 100%)',
      shadowColor: 'rgba(37, 99, 235, 0.40)',
      accentHex: '#2563EB',
    },
    {
      id: 'pigmy-interest',
      titleMr: 'पिग्मी व्याज आकारणी',
      titleEn: 'INTEREST',
      subtitleMr: 'पिग्मी खाते व्याज पोस्टिंग',
      icon: AnimatedInterestIcon,
      tab: 'pigmy-interest',
      params: {},
      gradient: 'linear-gradient(135deg, #34D399 0%, #10B981 55%, #047857 100%)',
      shadowColor: 'rgba(16, 185, 129, 0.38)',
      accentHex: '#059669',
    },
    {
      id: 'pigmy-closure',
      titleMr: 'पिग्मी खाते बंद',
      titleEn: 'CLOSING',
      subtitleMr: 'मुदतपूर्ती व खाते समाप्ती',
      icon: AnimatedAccountCloseIcon,
      tab: 'pigmy-closure',
      params: {},
      gradient: 'linear-gradient(135deg, #22D3EE 0%, #0891B2 55%, #0369A1 100%)',
      shadowColor: 'rgba(8, 145, 178, 0.38)',
      accentHex: '#0E7490',
    },
  ];

  return (
    <AuroraHubLayout
      badgeLabel="PIGMY DEPOSIT CORE HUB"
      titleMr="पिग्मी ठेव विभाग मुख्य हब"
      subtitleMr="पिग्मी एजंट नोंदणी • दैनंदिन वसुली • एजंट डे-बुक • कमिशन वाटप • व्याज आकारणी व खाते बंद"
      heroIcon={AnimatedSavingIcon}
      heroEmblemGradient="linear-gradient(135deg, #34D399 0%, #10B981 52%, #0891B2 100%)"
      heroGlowGradient="linear-gradient(135deg, #10B981 0%, #06B6D4 55%, #2563EB 100%)"
      underlineGradient="linear-gradient(90deg, #10B981 0%, #06B6D4 50%, #2563EB 100%)"
      accentSparkleColor="#10B981"
      items={pigmyActionButtons}
      onNavigate={onNavigate}
    />
  );
}
