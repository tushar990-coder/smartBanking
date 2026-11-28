import React from 'react';
import AuroraHubLayout, { AuroraHubActionItem } from './common/AuroraHubLayout';
import {
  AnimatedSavingIcon,
  AnimatedTransferIcon,
  AnimatedBulkChargesIcon,
  AnimatedInterestIcon,
  AnimatedPassbookIcon,
  AnimatedAccountCloseIcon,
} from './common/AnimatedDashboardIcons';

interface SavingDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function SavingDashboard({ onNavigate }: SavingDashboardProps) {
  const savingActionButtons: AuroraHubActionItem[] = [
    {
      id: 'saving-acc',
      titleMr: 'नवीन बचत खाते',
      titleEn: 'OPEN ACCOUNT',
      subtitleMr: 'नवीन बचत खाते नोंदणी व KYC',
      icon: AnimatedSavingIcon,
      tab: 'saving-account',
      params: {},
      gradient: 'linear-gradient(135deg, #EA580C 0%, #B44814 55%, #7C2418 100%)',
      shadowColor: 'rgba(180, 72, 20, 0.36)',
      accentHex: '#9A3412',
    },
    {
      id: 'saving-tx',
      titleMr: 'बचत जमा / नावे',
      titleEn: 'DEPOSIT / WD',
      subtitleMr: 'दैनिक रोख जमा व उचल व्यवहार',
      icon: AnimatedTransferIcon,
      tab: 'saving-transaction',
      params: {},
      gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 55%, #15803D 100%)',
      shadowColor: 'rgba(34, 197, 94, 0.38)',
      accentHex: '#16A34A',
    },
    {
      id: 'saving-bulk',
      titleMr: 'बचत बल्क ट्रान्सफर',
      titleEn: 'BULK TRANSFER',
      subtitleMr: 'एकत्रित बचत बिल व हस्तांतरण',
      icon: AnimatedBulkChargesIcon,
      tab: 'saving-bulk-transfer',
      params: {},
      gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 55%, #D97706 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.40)',
      accentHex: '#D97706',
    },
    {
      id: 'saving-post',
      titleMr: 'बचत व्याज आकारणी',
      titleEn: 'INTEREST',
      subtitleMr: 'सहामाही / वार्षिक व्याज जमा',
      icon: AnimatedInterestIcon,
      tab: 'saving-posting',
      params: {},
      gradient: 'linear-gradient(135deg, #C084FC 0%, #9333EA 55%, #6B21A8 100%)',
      shadowColor: 'rgba(147, 51, 234, 0.38)',
      accentHex: '#7E22CE',
    },
    {
      id: 'saving-pass',
      titleMr: 'पासबूक प्रिंटिंग',
      titleEn: 'PASSBOOK',
      subtitleMr: 'पासबूक मुख्य पान व नोंदी प्रिंट',
      icon: AnimatedPassbookIcon,
      tab: 'saving-passbook',
      params: {},
      gradient: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 55%, #0F766E 100%)',
      shadowColor: 'rgba(13, 148, 136, 0.36)',
      accentHex: '#0F766E',
    },
    {
      id: 'saving-close',
      titleMr: 'बचत खाते बंद',
      titleEn: 'CLOSING',
      subtitleMr: 'व्याज हिशोब व खाते समाप्ती',
      icon: AnimatedAccountCloseIcon,
      tab: 'saving-closing',
      params: {},
      gradient: 'linear-gradient(135deg, #FB7185 0%, #E11D48 55%, #9F1239 100%)',
      shadowColor: 'rgba(225, 29, 72, 0.36)',
      accentHex: '#BE123C',
    },
  ];

  return (
    <AuroraHubLayout
      badgeLabel="SAVINGS MODULE CORE HUB"
      titleMr="बचत ठेवी विभाग मुख्य हब"
      subtitleMr="नवीन बचत खाते नोंदणी • जमा / नावे व्यवहार • बल्क ट्रान्सफर • पासबूक प्रिंटिंग व व्याज आकारणी"
      heroIcon={AnimatedSavingIcon}
      heroEmblemGradient="linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)"
      heroGlowGradient="linear-gradient(135deg, #8C2D19 0%, #D97706 60%, #F59E0B 100%)"
      underlineGradient="linear-gradient(90deg, #7C2418 0%, #D97706 55%, #F59E0B 100%)"
      accentSparkleColor="#D97706"
      items={savingActionButtons}
      onNavigate={onNavigate}
    />
  );
}
