import { StyleSheet } from 'react-native';

// Ultra-Premium Private Members Club Design System
// Amex Centurion meets Apple meets Luxury Concierge OS
export const LuxuryColors = {
  // Aman x Apple x Centurion Palette
  background: '#071120',
  surface: '#0D1525',
  surfaceLight: '#141E33',
  surfaceDeep: '#050C16',

  // Minimal Violet Accents (subtle, not neon)
  violet: '#6B5CE7',
  violetLight: '#8B7FF0',
  violetGlow: 'rgba(107, 92, 231, 0.08)',

  // Brushed Gold
  gold: '#D4AF37',
  goldLight: '#E8C847',
  goldDark: '#B8960C',
  goldGlow: 'rgba(212, 175, 55, 0.15)',

  // Soft Ivory Text
  textPrimary: '#F8F6F0',
  textSecondary: '#B8B5A8',
  textTertiary: '#7A7668',
  textGold: '#D4AF37',

  // Ultra Glassmorphism (subtle)
  glass: 'rgba(255, 255, 255, 0.03)',
  glassBorder: 'rgba(255, 255, 255, 0.06)',
  glassStrong: 'rgba(255, 255, 255, 0.04)',

  // UI Elements
  divider: '#141E33',
  success: '#2ED573',
  error: '#FF4757',
} as const;

export const LuxurySpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const LuxuryBorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  full: 9999,
} as const;

export const LuxuryFontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  xxxxxl: 48,
} as const;

export const LuxuryFontFamily = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
} as const;

export const LuxuryShadow = {
  // Ultra-soft ambient shadows for depth
  soft: {
    shadowColor: '#030A14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 6,
  },
  medium: {
    shadowColor: '#030A14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 10,
  },
  strong: {
    shadowColor: '#030A14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 56,
    elevation: 14,
  },
  // Premium gold glow for elite elements
  gold: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  // Metallic sheen effect
  metallic: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  // Deep ambient glow for hero cards
  ambient: {
    shadowColor: '#030A14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 64,
    elevation: 12,
  },
} as const;

export const LuxuryGradients = {
  // Minimal Violet (subtle, refined)
  violet: ['#6B5CE7', '#8B7FF0'],
  violetDeep: ['#5A4BD6', '#6B5CE7'],
  violetGold: ['#6B5CE7', '#D4AF37'],
  
  // Brushed Gold
  gold: ['#D4AF37', '#E8C847'],
  goldDeep: ['#B8960C', '#D4AF37'],
  
  // Background/Surface (subtle depth)
  background: ['#071120', '#0D1525'],
  surface: ['#0D1525', '#141E33'],
  surfaceDeep: ['#050C16', '#071120'],
  
  // Premium Blends (subtle)
  violetSurface: ['#6B5CE7', '#141E33'],
  goldSurface: ['#D4AF37', '#0D1525'],
  
  // Subtle Gradients (editorial)
  smoke: ['#141E33', '#0D1525'],
  platinum: ['#B8B5A8', '#F8F6F0'],
} as const;

export const luxuryStyles = StyleSheet.create({
  background: {
    backgroundColor: LuxuryColors.background,
  },
  glassCard: {
    backgroundColor: LuxuryColors.glass,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    borderRadius: LuxuryBorderRadius.xxl,
  },
  goldText: {
    color: LuxuryColors.gold,
  },
  violetGlow: {
    shadowColor: LuxuryColors.violet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
});
