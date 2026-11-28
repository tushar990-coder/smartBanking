import React from 'react';
import AuroraHubLayout, { AuroraHubActionItem } from './common/AuroraHubLayout';
import {
  AnimatedCustomerIcon,
  AnimatedGoldLoanIcon,
  AnimatedTransferIcon,
  AnimatedLoanIcon,
  AnimatedAccountCloseIcon,
} from './common/AnimatedDashboardIcons';

interface SharesDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function SharesDashboard({ onNavigate }: SharesDashboardProps) {
  const sharesActionButtons: AuroraHubActionItem[] = [
    {
      id: 'member-master',
      titleMr: 'सभासद नोंदणी',
      titleEn: 'MEMBERS',
      subtitleMr: 'नवीन सभासद अर्ज व नोंदणी',
      icon: AnimatedCustomerIcon,
      tab: 'members',
      params: {},
      gradient: 'linear-gradient(135deg, #EA580C 0%, #B44814 55%, #7C2418 100%)',
      shadowColor: 'rgba(180, 72, 20, 0.38)',
      accentHex: '#9A3412',
    },
    {
      id: 'share-purchase',
      titleMr: 'भाग भांडवल वाटप',
      titleEn: 'ALLOTMENT',
      subtitleMr: 'अतिरिक्त शेअर्स खरेदी व प्रमाणपत्र',
      icon: AnimatedGoldLoanIcon,
      tab: 'share-master',
      params: {},
      gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 55%, #15803D 100%)',
      shadowColor: 'rgba(34, 197, 94, 0.38)',
      accentHex: '#16A34A',
    },
    {
      id: 'share-transfer',
      titleMr: 'भाग हस्तांतरण',
      titleEn: 'TRANSFER',
      subtitleMr: 'एका सभासदाकडून दुसऱ्याकडे हस्तांतरण',
      icon: AnimatedTransferIcon,
      tab: 'share-transfer',
      params: {},
      gradient: 'linear-gradient(135deg, #C084FC 0%, #9333EA 55%, #6B21A8 100%)',
      shadowColor: 'rgba(147, 51, 234, 0.38)',
      accentHex: '#7E22CE',
    },
    {
      id: 'share-withdrawal',
      titleMr: 'भाग भांडवल परतावा',
      titleEn: 'WITHDRAWAL',
      subtitleMr: 'अंशतः किंवा पूर्ण शेअर्स परतावा',
      icon: AnimatedLoanIcon,
      tab: 'share-withdrawal',
      params: {},
      gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 55%, #D97706 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.40)',
      accentHex: '#D97706',
    },
    {
      id: 'member-closure',
      titleMr: 'सभासद खाते बंद',
      titleEn: 'CLOSURE',
      subtitleMr: 'सभासदत्व समाप्ती व अंतिम हिशोब',
      icon: AnimatedAccountCloseIcon,
      tab: 'member-closure',
      params: {},
      gradient: 'linear-gradient(135deg, #FB7185 0%, #E11D48 55%, #9F1239 100%)',
      shadowColor: 'rgba(225, 29, 72, 0.36)',
      accentHex: '#BE123C',
    },
  ];

  return (
    <AuroraHubLayout
      badgeLabel="SHARES & MEMBERS CORE HUB"
      titleMr="सभासद व शेअर्स विभाग मुख्य हब"
      subtitleMr="नवीन सभासद नोंदणी • भाग भांडवल खरेदी व वाटप • भाग हस्तांतरण • परतावा व सभासदत्व समाप्ती"
      heroIcon={AnimatedCustomerIcon}
      heroEmblemGradient="linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)"
      heroGlowGradient="linear-gradient(135deg, #8C2D19 0%, #D97706 60%, #F59E0B 100%)"
      underlineGradient="linear-gradient(90deg, #7C2418 0%, #D97706 55%, #F59E0B 100%)"
      accentSparkleColor="#D97706"
      items={sharesActionButtons}
      onNavigate={onNavigate}
    />
  );
}
