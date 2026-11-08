export type GridSize = 3 | 4 | 5;

export type NodeShape = 'dots' | 'circles' | 'squares' | 'diamonds';

export type GridBackgroundStyle = 'clean' | 'dots' | 'radar' | 'grid';

export interface CustomGridStyle {
  nodeShape: NodeShape;
  nodeColor: string;
  connectionColor: string;
  successColor: string;
  errorColor: string;
  lineWidth: 'thin' | 'medium' | 'thick';
  glowIntensity: 'none' | 'subtle' | 'vibrant';
  gridBg: GridBackgroundStyle;
}

export type ThemeId = 'cyber-neon' | 'oled-dark' | 'sunset-ember' | 'matrix-green' | 'clean-slate';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  dotColor: string;
  dotActiveColor: string;
  dotSuccessColor: string;
  dotErrorColor: string;
  lineColor: string;
  lineSuccessColor: string;
  lineErrorColor: string;
  glowClass: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  bgGradient: string;
  phoneFrameClass: string;
  nodeShape?: NodeShape;
}

export type AppMode = 'lockscreen' | 'settings' | 'vault' | 'game' | 'analyzer' | 'mirror' | 'device-data';

export interface PatternSecurityReport {
  score: number; // 0 - 100
  rating: 'Muy débil' | 'Débil' | 'Media' | 'Fuerte' | 'Excelente';
  color: string;
  entropyBits: number;
  totalCombinations: string;
  length: number;
  directionChanges: number;
  crossovers: number;
  knightMoves: number;
  detectedShape?: string;
  warnings: string[];
  tips: string[];
}

export interface UnlockAttempt {
  id: string;
  timestamp: number;
  success: boolean;
  length: number;
  patternMasked: string;
  deviceInfo: string;
}

export interface EncryptedNote {
  id: string;
  title: string;
  content: string;
  category: 'Personal' | 'Trabajo' | 'Contraseñas' | 'Finanzas';
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

export interface ProtectedAppItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  isLocked: boolean;
  mockData: string;
}

export interface PatternPreset {
  id: string;
  name: string;
  description: string;
  pattern: number[];
  difficulty: 'Fácil' | 'Medio' | 'Difícil' | 'Extremo';
  shape: string;
}
