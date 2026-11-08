import { ThemeConfig, ThemeId } from '../types.ts';

export const THEMES: Record<ThemeId, ThemeConfig> = {
  'cyber-neon': {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    dotColor: '#334155', // slate-700
    dotActiveColor: '#06b6d4', // cyan-500
    dotSuccessColor: '#10b981', // emerald-500
    dotErrorColor: '#f43f5e', // rose-500
    lineColor: '#06b6d4',
    lineSuccessColor: '#10b981',
    lineErrorColor: '#f43f5e',
    glowClass: 'glow-cyan',
    accentBg: 'bg-cyan-500',
    accentText: 'text-cyan-400',
    accentBorder: 'border-cyan-500/40',
    bgGradient: 'from-slate-950 via-slate-900 to-cyan-950/20',
    phoneFrameClass: 'border-slate-800 bg-slate-950 shadow-2xl shadow-cyan-950/30',
  },
  'oled-dark': {
    id: 'oled-dark',
    name: 'OLED Obsidian',
    dotColor: '#262626', // neutral-800
    dotActiveColor: '#38bdf8', // sky-400
    dotSuccessColor: '#22c55e', // green-500
    dotErrorColor: '#ef4444', // red-500
    lineColor: '#38bdf8',
    lineSuccessColor: '#22c55e',
    lineErrorColor: '#ef4444',
    glowClass: 'glow-cyan',
    accentBg: 'bg-sky-500',
    accentText: 'text-sky-400',
    accentBorder: 'border-sky-500/30',
    bgGradient: 'from-black via-zinc-950 to-neutral-950',
    phoneFrameClass: 'border-neutral-800 bg-black shadow-2xl shadow-black',
  },
  'sunset-ember': {
    id: 'sunset-ember',
    name: 'Sunset Ember',
    dotColor: '#3f2c2c',
    dotActiveColor: '#f59e0b', // amber-500
    dotSuccessColor: '#10b981',
    dotErrorColor: '#f43f5e',
    lineColor: '#f59e0b',
    lineSuccessColor: '#10b981',
    lineErrorColor: '#f43f5e',
    glowClass: 'glow-amber',
    accentBg: 'bg-amber-500',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/40',
    bgGradient: 'from-zinc-950 via-stone-900 to-amber-950/20',
    phoneFrameClass: 'border-stone-800 bg-zinc-950 shadow-2xl shadow-amber-950/30',
  },
  'matrix-green': {
    id: 'matrix-green',
    name: 'Matrix Phosphor',
    dotColor: '#142918',
    dotActiveColor: '#10b981', // emerald-500
    dotSuccessColor: '#34d399',
    dotErrorColor: '#f43f5e',
    lineColor: '#10b981',
    lineSuccessColor: '#34d399',
    lineErrorColor: '#f43f5e',
    glowClass: 'glow-emerald',
    accentBg: 'bg-emerald-500',
    accentText: 'text-emerald-400',
    accentBorder: 'border-emerald-500/40',
    bgGradient: 'from-black via-slate-950 to-emerald-950/20',
    phoneFrameClass: 'border-emerald-950/50 bg-black shadow-2xl shadow-emerald-950/30',
  },
  'clean-slate': {
    id: 'clean-slate',
    name: 'Minimalist Steel',
    dotColor: '#475569',
    dotActiveColor: '#6366f1', // indigo-500
    dotSuccessColor: '#10b981',
    dotErrorColor: '#f43f5e',
    lineColor: '#6366f1',
    lineSuccessColor: '#10b981',
    lineErrorColor: '#f43f5e',
    glowClass: 'glow-cyan',
    accentBg: 'bg-indigo-600',
    accentText: 'text-indigo-400',
    accentBorder: 'border-indigo-500/40',
    bgGradient: 'from-slate-950 via-slate-900 to-slate-950',
    phoneFrameClass: 'border-slate-800 bg-slate-900 shadow-2xl shadow-indigo-950/20',
  },
};
