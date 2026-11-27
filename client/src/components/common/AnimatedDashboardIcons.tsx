import React from 'react';

interface AnimatedIconProps {
  className?: string;
}

// 1. बचत खाते (SAVINGS) — Piggy Bank + Dropping Gold ₹ Coin + Sparkles
export const AnimatedSavingIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path
      d="M7.5 8.5L8.2 6.8L8.9 8.5L10.6 9.2L8.9 9.9L8.2 11.6L7.5 9.9L5.8 9.2L7.5 8.5Z"
      fill="#FEF08A"
      className="animate-saving-sparkle-1"
    />
    <path
      d="M27.2 7.2L27.8 5.8L28.4 7.2L29.8 7.8L28.4 8.4L27.8 9.8L27.2 8.4L25.8 7.8L27.2 7.2Z"
      fill="#BAE6FD"
      className="animate-saving-sparkle-2"
    />
    <g className="animate-saving-coin">
      <circle cx="18" cy="9.5" r="4.3" fill="#FACC15" stroke="#FEF9C3" strokeWidth="1" />
      <text x="18" y="11.4" textAnchor="middle" fill="#92400E" fontSize="5.8" fontWeight="900" fontFamily="sans-serif">
        ₹
      </text>
    </g>
    <g className="animate-saving-piggy">
      <path d="M8.4 20.5C6.5 20.3 5.8 18.8 6.8 17.7" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M22.2 14.3L24.5 11.8C25.2 11.1 26.4 11.7 26.2 12.7L25.6 15.6" fill="#FFFFFF" />
      <path
        d="M17.6 13.6C12.3 13.6 8.2 16.8 8.2 21.1C8.2 24.1 10.1 26.5 12.9 27.6V29.8C12.9 30.6 13.5 31.2 14.3 31.2H15.5C16.3 31.2 16.9 30.6 16.9 29.8V28.4H20.3V29.8C20.3 30.6 20.9 31.2 21.7 31.2H22.9C23.7 31.2 24.3 30.6 24.3 29.8V27.4C26 26.6 27.2 25.3 27.8 23.7H29.4C30.4 23.7 31.2 22.9 31.2 21.9V20.2C31.2 19.2 30.4 18.4 29.4 18.4H28C27 15.6 22.9 13.6 17.6 13.6Z"
        fill="#FFFFFF"
      />
      <rect x="14.7" y="15.3" width="6.6" height="1.7" rx="0.85" fill="#1D4ED8" />
      <circle cx="25.2" cy="19.3" r="1.15" fill="#1D4ED8" />
      <text x="17.8" y="24.9" textAnchor="middle" fill="#1D8CF8" fontSize="7.4" fontWeight="900" fontFamily="sans-serif">
        ₹
      </text>
    </g>
  </svg>
);

// 2. मुदत व ठेवी (DEPOSITS) — Secure Vault Wallet + Floating Gold FD Certificate + Interest Sparkle
export const AnimatedDepositIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Rising Golden Deposit Bond / Note */}
    <g className="animate-deposit-note">
      <rect x="10.5" y="7.5" width="15" height="9.5" rx="2" fill="#FDE047" stroke="#FEF9C3" strokeWidth="1" />
      <text x="18" y="14.1" textAnchor="middle" fill="#15803D" fontSize="6.4" fontWeight="900" fontFamily="sans-serif">
        ₹
      </text>
    </g>
    {/* Sparkle */}
    <path
      d="M28.2 7.5L28.8 6L29.4 7.5L30.9 8.1L29.4 8.7L28.8 10.2L28.2 8.7L26.7 8.1L28.2 7.5Z"
      fill="#FEF08A"
      className="animate-saving-sparkle-1"
    />
    {/* Crisp White Deposit Wallet / Safe Body */}
    <rect x="6.5" y="13.5" width="23" height="16" rx="3.5" fill="#FFFFFF" />
    {/* Subtle Top Pocket Seam */}
    <path d="M6.5 17H29.5" stroke="#BBF7D0" strokeWidth="1.2" />
    {/* Clasp Flap */}
    <rect x="21.5" y="19" width="9" height="5.5" rx="2.75" fill="#15803D" stroke="#FFFFFF" strokeWidth="1.2" />
    {/* Glowing Clasp Dot */}
    <circle cx="24.6" cy="21.75" r="1.4" fill="#FDE047" className="animate-dot-pulse" />
    {/* Mini Safe Accent Bars */}
    <rect x="9.5" y="20.2" width="8.5" height="1.6" rx="0.8" fill="#86EFAC" />
    <rect x="9.5" y="23.2" width="5.8" height="1.6" rx="0.8" fill="#86EFAC" />
  </svg>
);

// 3. कर्ज व्यवहार (LOANS) — Helping Hand + Floating Glowing Rupee Coin
export const AnimatedLoanIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Soft Radiating Glow Lines */}
    <g className="animate-saving-sparkle-1">
      <path d="M18 4.2V6.2" stroke="#FEF9C3" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11.6 6.8L13 8.2" stroke="#FEF9C3" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24.4 6.8L23 8.2" stroke="#FEF9C3" strokeWidth="1.5" strokeLinecap="round" />
    </g>
    {/* Hovering Rupee Coin */}
    <g className="animate-loan-coin">
      <circle cx="18" cy="13.2" r="5.6" fill="#FFFFFF" stroke="#FEF08A" strokeWidth="1.4" />
      <text x="18" y="15.8" textAnchor="middle" fill="#D97706" fontSize="8.2" fontWeight="900" fontFamily="sans-serif">
        ₹
      </text>
    </g>
    {/* Crisp White Helping Palm */}
    <path
      d="M6.5 23.6C6.5 22.7 7.2 22 8.1 22H12.4C13.6 22 14.8 22.5 15.8 23.2H20.8C22 23.2 23 24.1 23 25.2C23 25.3 23 25.4 22.9 25.5L26.8 24.1C27.8 23.7 28.9 24.2 29.3 25.2C29.7 26.2 29.2 27.3 28.2 27.7L20.6 30.6C19.6 31 18.5 31.1 17.4 30.9L10.6 29.5H8.1C7.2 29.5 6.5 28.8 6.5 27.9V23.6Z"
      fill="#FFFFFF"
    />
    <rect x="6.2" y="21.8" width="3.5" height="8" rx="1.4" fill="#FEF3C7" />
  </svg>
);

// 4. व्हाऊचर / व्यवहार (TRANSFERS) — Gliding Opposing Arrows + Pulsing ₹ Center
export const AnimatedTransferIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Top Arrow Sliding Right */}
    <g className="animate-transfer-right">
      <path d="M8 12.5H26" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M22.2 8.5L26.8 12.5L22.2 16.5" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    {/* Bottom Arrow Sliding Left */}
    <g className="animate-transfer-left">
      <path d="M28 23.5H10" stroke="#FDE047" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M13.8 19.5L9.2 23.5L13.8 27.5" stroke="#FDE047" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    {/* Glowing Center Pill */}
    <circle cx="18" cy="18" r="3.4" fill="#6B21A8" stroke="#FFFFFF" strokeWidth="1.2" />
    <text x="18" y="19.9" textAnchor="middle" fill="#FEF08A" fontSize="5.2" fontWeight="900" fontFamily="sans-serif">
      ₹
    </text>
  </svg>
);

// 5. खातेदार (CUSTOMERS) — Primary & Companion Customer Silhouettes + Verified KYC Badge
export const AnimatedCustomerIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Companion Silhouette (Right-Back) */}
    <circle cx="24.5" cy="13.5" r="3.2" fill="#BFDBFE" />
    <path d="M20.5 26.5C20.5 22.8 22.8 20.5 25.8 20.5C28.5 20.5 30.2 22.3 30.5 25.5V26.8H20.5V26.5Z" fill="#BFDBFE" />
    {/* Main Customer Silhouette */}
    <g className="animate-customer-bob">
      <circle cx="15" cy="13" r="4.5" fill="#FFFFFF" />
      <path
        d="M6.8 27.6C6.8 22.6 10.2 19.6 15 19.6C19.8 19.6 23.2 22.6 23.2 27.6C23.2 28.4 22.6 29 21.8 29H8.2C7.4 29 6.8 28.4 6.8 27.6Z"
        fill="#FFFFFF"
      />
    </g>
    {/* Verified Golden-Green KYC Check Badge */}
    <g className="animate-badge-pop">
      <circle cx="27.2" cy="25.2" r="4.6" fill="#22C55E" stroke="#FFFFFF" strokeWidth="1.4" />
      <path d="M25.2 25.3L26.6 26.7L29.4 23.8" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

// 6. पासिंग व मंजुरी (APPROVALS) — Security Shield + Self-Drawing Checkmark + Sparkle
export const AnimatedApprovalIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Sparkle Accent */}
    <path
      d="M27.8 7.5L28.4 6L29 7.5L30.5 8.1L29 8.7L28.4 10.2L27.8 8.7L26.3 8.1L27.8 7.5Z"
      fill="#FEF08A"
      className="animate-saving-sparkle-1"
    />
    {/* Shield Crest */}
    <g className="animate-shield-pulse">
      <path
        d="M18 6.2L28 10.1V17.4C28 23.5 23.7 28.6 18 30.4C12.3 28.6 8 23.5 8 17.4V10.1L18 6.2Z"
        fill="#FFFFFF"
      />
      <path
        d="M18 8.5L25.8 11.5V17.3C25.8 22.1 22.5 26.2 18 27.8C13.5 26.2 10.2 22.1 10.2 17.3V11.5L18 8.5Z"
        fill="#D1FAE5"
      />
      {/* Animated Checkmark */}
      <path
        d="M13.5 18.2L16.7 21.4L23.2 14.8"
        stroke="#047857"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="18"
        className="animate-check-draw"
      />
    </g>
  </svg>
);

// 7. आजची कामे (ALERTS) — Ringing Bell + Sound Waves + Live Alert Dot
export const AnimatedAlertsIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Ringing Sound Wave Arcs */}
    <g className="animate-bell-waves">
      <path d="M8.5 12.2C7.4 13.8 7 15.6 7.3 17.4" stroke="#EDE9FE" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M27.5 12.2C28.6 13.8 29 15.6 28.7 17.4" stroke="#EDE9FE" strokeWidth="1.6" strokeLinecap="round" />
    </g>
    {/* Swinging Bell Body */}
    <g className="animate-bell-swing">
      <circle cx="18" cy="8.2" r="1.8" fill="#FEF08A" />
      <path
        d="M18 9.4C13.6 9.4 10.6 12.5 10.6 16.9V21.5L8.6 24.4C8.2 25 8.6 25.8 9.4 25.8H26.6C27.4 25.8 27.8 25 27.4 24.4L25.4 21.5V16.9C25.4 12.5 22.4 9.4 18 9.4Z"
        fill="#FFFFFF"
      />
      <path d="M15.2 27.2C15.6 28.8 16.7 29.8 18 29.8C19.3 29.8 20.4 28.8 20.8 27.2H15.2Z" fill="#FEF08A" />
    </g>
    {/* Pulsing Live Notification Dot */}
    <circle cx="25.6" cy="10.4" r="3.2" fill="#FACC15" stroke="#FFFFFF" strokeWidth="1.2" className="animate-dot-pulse" />
  </svg>
);

// 8. अहवाल केंद्र (REPORTS) — Animated Rising Chart Bars + Gliding Trend Arrow
export const AnimatedReportsIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Rising Bar 1 */}
    <rect x="8.2" y="20" width="4.6" height="9.2" rx="1.4" fill="#CFFAFE" className="animate-bar-1" />
    {/* Rising Bar 2 */}
    <rect x="15.7" y="15.5" width="4.6" height="13.7" rx="1.4" fill="#FFFFFF" className="animate-bar-2" />
    {/* Rising Bar 3 */}
    <rect x="23.2" y="11" width="4.6" height="18.2" rx="1.4" fill="#FFFFFF" className="animate-bar-3" />
    {/* Base Axis Line */}
    <path d="M6.5 29.6H29.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    {/* Upward Golden Trend Arrow */}
    <g className="animate-trend-rise">
      <path d="M8.5 16.2L15.2 11.4L19.6 13.4L27.2 7.2" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M23.5 6.8H27.6V10.8" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

// 9. कर्ज हप्ता वसुली (LOAN COLLECTION) — Receipt Slip + Animated Paid Check Badge
export const AnimatedLoanCollectionIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Receipt Sheet */}
    <g className="animate-customer-bob">
      <path
        d="M9 7.5C9 6.7 9.7 6 10.5 6H23.5C24.3 6 25 6.7 25 7.5V28.8L22.4 27L19.8 28.8L17 27L14.2 28.8L11.6 27L9 28.8V7.5Z"
        fill="#FFFFFF"
      />
      <text x="17" y="15.5" textAnchor="middle" fill="#15803D" fontSize="8.2" fontWeight="900" fontFamily="sans-serif">
        ₹
      </text>
      <rect x="12" y="18.2" width="10" height="1.6" rx="0.8" fill="#86EFAC" />
      <rect x="12" y="21.2" width="7.2" height="1.6" rx="0.8" fill="#86EFAC" />
    </g>
    {/* Popping Golden Paid Badge */}
    <g className="animate-badge-pop">
      <circle cx="26.2" cy="24.2" r="5" fill="#FACC15" stroke="#FFFFFF" strokeWidth="1.4" />
      <path d="M24 24.3L25.5 25.8L28.5 22.7" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

// 10. सोने तारण कर्ज (GOLD LOAN) — Gleaming Stacked Gold Bars + Shimmering Sparkles
export const AnimatedGoldLoanIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Twinkling Gold Sparkles */}
    <path
      d="M9.5 8.5L10.3 6.5L11.1 8.5L13.1 9.3L11.1 10.1L10.3 12.1L9.5 10.1L7.5 9.3L9.5 8.5Z"
      fill="#FEF9C3"
      className="animate-saving-sparkle-1"
    />
    <path
      d="M26.5 7.8L27.2 6.1L27.9 7.8L29.6 8.5L27.9 9.2L27.2 10.9L26.5 9.2L24.8 8.5L26.5 7.8Z"
      fill="#FFFFFF"
      className="animate-saving-sparkle-2"
    />
    {/* Top Floating Gold Ingot */}
    <g className="animate-loan-coin">
      <path d="M13.2 13.5L15 9.8H21L22.8 13.5H13.2Z" fill="#FEF08A" />
      <path d="M12.2 13.5H23.8L25 18.2H11L12.2 13.5Z" fill="#FFFFFF" />
      <text x="18" y="17.1" textAnchor="middle" fill="#D97706" fontSize="5.6" fontWeight="900" fontFamily="sans-serif">
        ₹
      </text>
    </g>
    {/* Bottom Twin Gold Bars */}
    <path d="M6.8 20.4H16.6L17.6 26.8H5.8L6.8 20.4Z" fill="#FFFFFF" />
    <path d="M8 20.4L9.2 18.2H14.2L15.4 20.4H8Z" fill="#FEF3C7" />
    <path d="M19.4 20.4H29.2L30.2 26.8H18.4L19.4 20.4Z" fill="#FFFFFF" />
    <path d="M20.6 20.4L21.8 18.2H26.8L28 20.4H20.6Z" fill="#FEF3C7" />
  </svg>
);

// 11. कर्ज व्याज आकारणी (INTEREST POSTING) — Glowing Percent Coin + Sparkles
export const AnimatedInterestIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path
      d="M8 9.2L8.7 7.4L9.4 9.2L11.2 9.9L9.4 10.6L8.7 12.4L8 10.6L6.2 9.9L8 9.2Z"
      fill="#FEF08A"
      className="animate-saving-sparkle-1"
    />
    <g className="animate-shield-pulse">
      <circle cx="18" cy="18.2" r="10.2" fill="#FFFFFF" />
      <circle cx="18" cy="18.2" r="8.2" fill="#F3E8FF" />
      {/* Bold Animated Percent Symbol */}
      <path d="M14 22.2L22 14.2" stroke="#7E22CE" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14.2" cy="14.5" r="2.1" fill="#F59E0B" />
      <circle cx="21.8" cy="21.9" r="2.1" fill="#7E22CE" />
    </g>
    <circle cx="27.2" cy="10.2" r="2.6" fill="#FDE047" stroke="#FFFFFF" strokeWidth="1" className="animate-dot-pulse" />
  </svg>
);

// 12. वसुली खर्च नावे (BULK CHARGES) — Ledger Sheet + Dropping Charge Coin
export const AnimatedBulkChargesIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Dropping Charge Coin */}
    <g className="animate-saving-coin">
      <circle cx="25.5" cy="10.5" r="4.2" fill="#FACC15" stroke="#FEF9C3" strokeWidth="1" />
      <text x="25.5" y="12.3" textAnchor="middle" fill="#1E3A8A" fontSize="5.8" fontWeight="900" fontFamily="sans-serif">
        ₹
      </text>
    </g>
    {/* Ledger Document */}
    <rect x="7.5" y="10.5" width="18" height="19.5" rx="2.8" fill="#FFFFFF" />
    <rect x="10.5" y="14.5" width="12" height="2" rx="1" fill="#2563EB" />
    <rect x="10.5" y="18.8" width="9.5" height="1.8" rx="0.9" fill="#93C5FD" />
    <rect x="10.5" y="22.4" width="11" height="1.8" rx="0.9" fill="#93C5FD" />
    <rect x="10.5" y="26" width="7" height="1.8" rx="0.9" fill="#60A5FA" />
  </svg>
);

// 13. बाह्य कर्जे / पुनर्गहाण (BANK BORROWINGS) — Bank Building + Two-Way Flow Arrows
export const AnimatedBorrowingIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Animated Two-Way Top Arrows */}
    <g className="animate-transfer-right">
      <path d="M11 8.5H24.5" stroke="#FDE047" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M21.8 6.2L24.8 8.5L21.8 10.8" stroke="#FDE047" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    {/* Bank Facade */}
    <g className="animate-customer-bob">
      <path d="M18 11.8L28.5 16.5H7.5L18 11.8Z" fill="#FFFFFF" />
      <rect x="9.8" y="17.8" width="2.8" height="8.2" rx="0.8" fill="#EDE9FE" />
      <rect x="16.6" y="17.8" width="2.8" height="8.2" rx="0.8" fill="#FFFFFF" />
      <rect x="23.4" y="17.8" width="2.8" height="8.2" rx="0.8" fill="#EDE9FE" />
      <rect x="7" y="26.8" width="22" height="2.6" rx="1.2" fill="#FFFFFF" />
    </g>
  </svg>
);

// 14. पासबूक / बॅच प्रिंटिंग (PASSBOOK / PRINT) — Printer + Sliding Printed Slip
export const AnimatedPassbookIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Top Paper Feed */}
    <rect x="11" y="6.5" width="14" height="6.5" rx="1.5" fill="#E0F2FE" />
    {/* Printer Body */}
    <rect x="6.5" y="12" width="23" height="11.5" rx="3" fill="#FFFFFF" />
    <circle cx="25.2" cy="15.8" r="1.4" fill="#22C55E" className="animate-dot-pulse" />
    {/* Sliding Printed Passbook Page */}
    <g className="animate-deposit-note">
      <rect x="10.5" y="19.5" width="15" height="10.5" rx="1.8" fill="#FEF9C3" stroke="#FFFFFF" strokeWidth="1" />
      <rect x="13" y="22.4" width="10" height="1.5" rx="0.75" fill="#0369A1" />
      <rect x="13" y="25.4" width="7.2" height="1.5" rx="0.75" fill="#0EA5E9" />
    </g>
  </svg>
);

// 15. खाते बंद / परतावा (CLOSING / MATURITY) — Folder + Golden Seal Check
export const AnimatedAccountCloseIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* Account Folder */}
    <g className="animate-customer-bob">
      <path
        d="M6.5 11.5C6.5 10.1 7.6 9 9 9H14.6L17 11.6H27C28.4 11.6 29.5 12.7 29.5 14.1V25.5C29.5 26.9 28.4 28 27 28H9C7.6 28 6.5 26.9 6.5 25.5V11.5Z"
        fill="#FFFFFF"
      />
      <rect x="10" y="16.2" width="11" height="1.8" rx="0.9" fill="#CBD5E1" />
      <rect x="10" y="19.8" width="8" height="1.8" rx="0.9" fill="#CBD5E1" />
    </g>
    {/* Golden Seal Badge */}
    <g className="animate-badge-pop">
      <circle cx="26.2" cy="24.6" r="4.8" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.4" />
      <path d="M24.2 24.7L25.6 26.1L28.4 23.2" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

// 16. जर्नल / खाते उघडणे (JOURNAL / ACCOUNT BOOK) — Ledger Book + Golden Sparkle
export const AnimatedJournalIcon: React.FC<AnimatedIconProps> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path
      d="M27.6 7.4L28.3 5.8L29 7.4L30.6 8.1L29 8.8L28.3 10.4L27.6 8.8L26 8.1L27.6 7.4Z"
      fill="#FEF08A"
      className="animate-saving-sparkle-1"
    />
    <g className="animate-shield-pulse">
      <rect x="8" y="7.5" width="19.5" height="21.5" rx="3" fill="#FFFFFF" />
      <rect x="8" y="7.5" width="4.4" height="21.5" rx="1.5" fill="#DBEAFE" />
      <rect x="14.6" y="12" width="10" height="2" rx="1" fill="#2563EB" />
      <rect x="14.6" y="16.4" width="8.5" height="1.8" rx="0.9" fill="#93C5FD" />
      <rect x="14.6" y="20.4" width="9.5" height="1.8" rx="0.9" fill="#93C5FD" />
      <circle cx="24" cy="25" r="2.2" fill="#FACC15" className="animate-dot-pulse" />
    </g>
  </svg>
);
