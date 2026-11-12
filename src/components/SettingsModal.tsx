import React, { useState } from 'react';
import { CustomGridStyle, GridSize, NodeShape, ThemeConfig, ThemeId } from '../types.ts';
import { THEMES } from '../utils/themes.ts';
import { playClickSound } from '../utils/sound.ts';
import { PatternGrid } from './PatternGrid.tsx';
import {
  Settings,
  X,
  Palette,
  Grid3X3,
  Volume2,
  Smartphone,
  EyeOff,
  Hash,
  RotateCcw,
  Sparkles,
  Sliders,
  Check,
  Shapes,
  Circle,
  Fingerprint,
  ShieldCheck,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gridSize: GridSize;
  onChangeGridSize: (size: GridSize) => void;
  currentThemeId: ThemeId;
  onChangeTheme: (themeId: ThemeId) => void;
  soundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  hapticsEnabled: boolean;
  onToggleHaptics: (enabled: boolean) => void;
  hideTrail: boolean;
  onToggleHideTrail: (hide: boolean) => void;
  showNumbers: boolean;
  onToggleShowNumbers: (show: boolean) => void;
  customStyle: CustomGridStyle;
  onChangeCustomStyle: (style: CustomGridStyle) => void;
  onResetToDefaultPattern: () => void;
  theme: ThemeConfig;
  isBiometricRequired?: boolean;
  onToggleBiometricRequired?: (required: boolean) => void;
  onTestBiometricChallenge?: () => void;
}

const CONNECTION_COLOR_PRESETS = [
  { name: 'Cian Neón', hex: '#06b6d4' },
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Azul Cielo', hex: '#38bdf8' },
  { name: 'Violeta Cyber', hex: '#a855f7' },
  { name: 'Ámbar Solar', hex: '#f59e0b' },
  { name: 'Rosa Neón', hex: '#f43f5e' },
  { name: 'Blanco Puro', hex: '#ffffff' },
];

const INACTIVE_NODE_PRESETS = [
  { name: 'Pizarra', hex: '#334155' },
  { name: 'Carbón', hex: '#262626' },
  { name: 'Acero', hex: '#475569' },
  { name: 'Marina', hex: '#1e293b' },
  { name: 'Terminal', hex: '#142918' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  gridSize,
  onChangeGridSize,
  currentThemeId,
  onChangeTheme,
  soundEnabled,
  onToggleSound,
  hapticsEnabled,
  onToggleHaptics,
  hideTrail,
  onToggleHideTrail,
  showNumbers,
  onToggleShowNumbers,
  customStyle,
  onChangeCustomStyle,
  onResetToDefaultPattern,
  theme,
  isBiometricRequired = true,
  onToggleBiometricRequired,
  onTestBiometricChallenge,
}) => {
  const [modalTab, setModalTab] = useState<'visual' | 'system'>('visual');
  const [previewPattern, setPreviewPattern] = useState<number[]>([0, 1, 4, 7, 8]);

  if (!isOpen) return null;

  const updateStyle = (patch: Partial<CustomGridStyle>) => {
    playClickSound(soundEnabled);
    onChangeCustomStyle({
      ...customStyle,
      ...patch,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Personalización & Ajustes de Patrón</h3>
              <p className="text-[11px] text-slate-400">Temas, geometría de nodos, colores y seguridad</p>
            </div>
          </div>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-1 p-2 bg-slate-950 border-b border-slate-800 shrink-0">
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setModalTab('visual');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              modalTab === 'visual'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shapes className="w-3.5 h-3.5" />
            <span>Formas & Colores de Cuadrícula</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setModalTab('system');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              modalTab === 'system'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Matriz & Sistema</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 overflow-y-auto space-y-5 text-xs">
          {modalTab === 'visual' && (
            <div className="space-y-5">
              {/* Live Interactive Preview Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-1 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" /> Vista Previa en Vivo
                  </span>
                  <span>Prueba a trazar aquí</span>
                </div>
                <div className="w-48 h-48 py-1">
                  <PatternGrid
                    gridSize={gridSize}
                    theme={theme}
                    customStyle={customStyle}
                    soundEnabled={soundEnabled}
                    hapticsEnabled={hapticsEnabled}
                    highlightPattern={previewPattern}
                    onPatternComplete={(p) => setPreviewPattern(p)}
                    showNumbers={showNumbers}
                  />
                </div>
              </div>

              {/* 1. Forma de los Nodos / Puntos */}
              <div>
                <label className="text-slate-200 font-bold mb-2 flex items-center gap-1.5">
                  <Shapes className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Forma de los Puntos / Nodos</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    { id: 'dots', label: 'Puntos Sólidos', desc: 'Clásico Android', icon: '●' },
                    { id: 'circles', label: 'Círculos / Aros', desc: 'Anillo concéntrico', icon: '◎' },
                    { id: 'squares', label: 'Cuadrados', desc: 'Geometría Tech', icon: '■' },
                    { id: 'diamonds', label: 'Rombos', desc: 'Diamante Cyber', icon: '◆' },
                  ] as const).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => updateStyle({ nodeShape: item.id })}
                      className={`p-2.5 rounded-2xl border text-center transition-all ${
                        customStyle.nodeShape === item.id
                          ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xl leading-none text-cyan-400 mb-1">{item.icon}</div>
                      <div className="font-bold text-xs">{item.label}</div>
                      <div className="text-[10px] text-slate-500">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Color de los Puntos de Conexión y Trazo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-200 font-bold flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Color de Puntos de Conexión y Trazo</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-mono">{customStyle.connectionColor}</span>
                    <input
                      type="color"
                      value={customStyle.connectionColor}
                      onChange={(e) => updateStyle({ connectionColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent"
                      title="Elegir cualquier color personalizado"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {CONNECTION_COLOR_PRESETS.map((preset) => {
                    const isSelected = customStyle.connectionColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        onClick={() => updateStyle({ connectionColor: preset.hex })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-slate-800 border-white text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-black/30 shadow-sm"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span className="text-xs">{preset.name}</span>
                        {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Color de los Puntos en Reposo (Inactivos) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-200 font-bold flex items-center gap-1.5">
                    <Circle className="w-3.5 h-3.5 text-slate-400" />
                    <span>Color de Nodos en Reposo (Inactivos)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-mono">{customStyle.nodeColor}</span>
                    <input
                      type="color"
                      value={customStyle.nodeColor}
                      onChange={(e) => updateStyle({ nodeColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {INACTIVE_NODE_PRESETS.map((preset) => {
                    const isSelected = customStyle.nodeColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        onClick={() => updateStyle({ nodeColor: preset.hex })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-slate-800 border-white text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-black/30"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span className="text-xs">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Grosor de Línea y Brillo Neón */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Line width */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                  <label className="block text-slate-300 font-semibold mb-2">Grosor del Trazo</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['thin', 'medium', 'thick'] as const).map((w) => (
                      <button
                        key={w}
                        onClick={() => updateStyle({ lineWidth: w })}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
                          customStyle.lineWidth === w
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {w === 'thin' ? 'Fino' : w === 'medium' ? 'Medio' : 'Grueso'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Glow intensity */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                  <label className="block text-slate-300 font-semibold mb-2">Efecto Brillo Neón</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['none', 'subtle', 'vibrant'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => updateStyle({ glowIntensity: g })}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
                          customStyle.glowIntensity === g
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {g === 'none' ? 'Apagado' : g === 'subtle' ? 'Sutil' : 'Vibrante'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5. Fondo y Guías de la Cuadrícula */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                <label className="block text-slate-300 font-semibold mb-2">Fondo y Guías de Cuadrícula</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['clean', 'grid', 'radar'] as const).map((bg) => (
                    <button
                      key={bg}
                      onClick={() => updateStyle({ gridBg: bg })}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        customStyle.gridBg === bg
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {bg === 'clean' ? 'Limpio' : bg === 'grid' ? 'Guías Matrix' : 'Radar Circular'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {modalTab === 'system' && (
            <div className="space-y-5">
              {/* Grid Size */}
              <div>
                <label className="text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                  <Grid3X3 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Dimensión de Matriz de Puntos</span>
                </label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {([3, 4, 5] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        playClickSound(soundEnabled);
                        onChangeGridSize(size);
                      }}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        gridSize === size
                          ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md shadow-cyan-950/30'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-base font-extrabold">{size} × {size}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        {size === 3 ? 'Estándar (9)' : size === 4 ? 'Avanzado (16)' : 'Ultra (25)'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Palettes */}
              <div>
                <label className="text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Temas Predefinidos</span>
                </label>
                <div className="space-y-1.5 mt-1">
                  {(Object.keys(THEMES) as ThemeId[]).map((themeId) => {
                    const item = THEMES[themeId];
                    const isActive = currentThemeId === themeId;
                    return (
                      <button
                        key={themeId}
                        onClick={() => {
                          playClickSound(soundEnabled);
                          onChangeTheme(themeId);
                          // Sync customStyle colors to theme colors
                          onChangeCustomStyle({
                            ...customStyle,
                            connectionColor: item.lineColor,
                            nodeColor: item.dotColor,
                            successColor: item.lineSuccessColor,
                            errorColor: item.lineErrorColor,
                          });
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                          isActive
                            ? 'bg-slate-800/90 border-cyan-500/50 text-white font-semibold shadow-sm'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-4 h-4 rounded-full border border-white/20"
                            style={{ backgroundColor: item.lineColor }}
                          />
                          <span className="text-xs">{item.name}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.dotActiveColor }}
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.dotSuccessColor }}
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.dotErrorColor }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Audio & Haptic Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-semibold text-white">Efectos de Sonido</div>
                      <div className="text-[10px] text-slate-400">Audio sintetizado de respuesta por nodo</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => onToggleSound(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Smartphone className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-semibold text-white">Vibración Háptica</div>
                      <div className="text-[10px] text-slate-400">Retroalimentación física al tocar nodos</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={hapticsEnabled}
                    onChange={(e) => onToggleHaptics(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 text-slate-300">
                    <EyeOff className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-semibold text-white">Ocultar Trazo (Privacidad)</div>
                      <div className="text-[10px] text-slate-400">No dibuja la línea visible contra observadores</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={hideTrail}
                    onChange={(e) => onToggleHideTrail(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Hash className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-semibold text-white">Mostrar Orden Numérico</div>
                      <div className="text-[10px] text-slate-400">Muestra números (1, 2, 3...) dentro de nodos</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showNumbers}
                    onChange={(e) => onToggleShowNumbers(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {/* Biometric Challenge Protection Toggle */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Fingerprint className="w-4 h-4 text-cyan-400" />
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span>Autenticación Biométrica Requerida</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                            MOCK BIOMETRIC
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Exigir huella dactilar o Face ID antes de abrir ajustes sensibles
                        </div>
                      </div>
                    </div>
                    {onToggleBiometricRequired && (
                      <input
                        type="checkbox"
                        checked={isBiometricRequired}
                        onChange={(e) => onToggleBiometricRequired(e.target.checked)}
                        className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                      />
                    )}
                  </div>

                  {onTestBiometricChallenge && (
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound(soundEnabled);
                        onClose();
                        onTestBiometricChallenge();
                      }}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700/80 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>Probar Desafío de Escaneo Huella / Face ID Ahora</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Reset Pattern */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    if (confirm('¿Restablecer el patrón de desbloqueo al valor predeterminado?')) {
                      onResetToDefaultPattern();
                      onClose();
                    }
                  }}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-rose-300 font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Restablecer Patrón a Predeterminado</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex justify-end shrink-0">
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              onClose();
            }}
            className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"
          >
            Listo y Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
