// Theme tokens for generated decks. The web renderer uses Tailwind classes that
// mirror these values (matching the existing dashboard); the same tokens will
// drive the future PPTX/PDF exporters so all three outputs stay identical.

import { ThemeName } from '@/types/deck'

export interface ThemeTokens {
  bg: string
  surface: string
  ink: string
  muted: string
  line: string
  accent: string
  accent2: string
  good: string
  warn: string
  radius: number
}

export const themes: Record<ThemeName, ThemeTokens> = {
  // 杏碩資訊 / Medus Technology — extracted from the company's own decks.
  medus: {
    bg: '#F2F3F5', // cool off-white
    surface: '#FFFFFF',
    ink: '#1F2A44',
    muted: '#5A6478',
    line: '#E3E7EE',
    accent: '#1F3A6D', // navy — primary
    accent2: '#2E5BAA', // royal blue
    good: '#059669',
    warn: '#DC2626',
    radius: 14,
  },
  executive: {
    bg: '#F1F5F9', // slate-100 — matches --background
    surface: '#FFFFFF',
    ink: '#0F172A', // slate-900 — matches --foreground
    muted: '#64748B', // slate-500
    line: '#E2E8F0', // slate-200
    accent: '#2563EB', // blue-600 — the dashboard primary
    accent2: '#4F46E5', // indigo-600
    good: '#059669', // emerald-600
    warn: '#EA580C', // orange-600
    radius: 12,
  },
  briefing: {
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    ink: '#0F172A',
    muted: '#64748B',
    line: '#E2E8F0',
    accent: '#4F46E5',
    accent2: '#2563EB',
    good: '#059669',
    warn: '#EA580C',
    radius: 12,
  },
  minimal: {
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    ink: '#0F172A',
    muted: '#64748B',
    line: '#E2E8F0',
    accent: '#0F172A',
    accent2: '#2563EB',
    good: '#059669',
    warn: '#EA580C',
    radius: 8,
  },
}

export const DEFAULT_THEME: ThemeName = 'executive'
