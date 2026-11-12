import React, { useState } from 'react';
import { PatternGrid } from './PatternGrid.tsx';
import { PatternAnalyticsDashboard } from './PatternAnalyticsDashboard.tsx';
import { CustomGridStyle, GridSize, PatternPreset, ThemeConfig, UnlockAttempt } from '../types.ts';
import { analyzePatternSecurity, arePatternsEqual, PRESET_PATTERNS } from '../utils/patternLogic.ts';
import { playClickSound, playErrorSound, playSuccessSound, triggerHaptic } from '../utils/sound.ts';
import { ShieldCheck, ShieldAlert, Sparkles, Check, ArrowRight, RotateCcw, AlertTriangle, Lightbulb, Play, Lock, BarChart3 } from 'lucide-react';

interface PatternAnalyzerProps {
  currentMasterPattern: number[];
  gridSize: GridSize;
  theme: ThemeConfig;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  showNumbers: boolean;
  customStyle?: Partial<CustomGridStyle>;
  onSaveMasterPattern: (pattern: number[]) => void;
  unlockAttempts?: UnlockAttempt[];
  onRecordAttempt?: (data: Omit<UnlockAttempt, 'id' | 'timestamp'>) => void;
  onClearAttempts?: () => void;
  onOpenSecurityApi?: () => void;
}

export const PatternAnalyzer: React.FC<PatternAnalyzerProps> = ({
  currentMasterPattern,
  gridSize,
  theme,
  soundEnabled,
  hapticsEnabled,
  showNumbers,
  customStyle,
  onSaveMasterPattern,
  unlockAttempts = [],
  onRecordAttempt,
  onClearAttempts,
  onOpenSecurityApi,
}) => {
  // Tabs: 'charts' (Panel Recharts), 'audit' (Auditoría libre y presets), 'setup' (Configurar patrón)
  const [activeTab, setActiveTab] = useState<'charts' | 'audit' | 'setup'>('charts');

  // Setup mode states
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [firstPattern, setFirstPattern] = useState<number[]>([]);
  const [secondPattern, setSecondPattern] = useState<number[]>([]);
  const [setupFeedback, setSetupFeedback] = useState<string>('Dibuja tu nuevo patrón (mínimo 4 nodos)');
  const [gridStatus, setGridStatus] = useState<'idle' | 'drawing' | 'success' | 'error'>('idle');

  // Audit / Free play mode states
  const [auditPattern, setAuditPattern] = useState<number[]>(currentMasterPattern);
  const [animatingPreset, setAnimatingPreset] = useState<number[] | undefined>(undefined);
  const [animatingName, setAnimatingName] = useState<string>('');

  // Live security report for whatever pattern is active
  const analyzedPattern = activeTab === 'setup' ? (setupStep === 1 ? firstPattern : secondPattern) : auditPattern;
  const securityReport = analyzePatternSecurity(analyzedPattern, gridSize);

  // Animate preset pattern
  const handlePreviewPreset = (preset: PatternPreset) => {
    setAnimatingName(preset.name);
    setAnimatingPreset([]);
    const full = preset.pattern;

    full.forEach((_, idx) => {
      setTimeout(() => {
        setAnimatingPreset(full.slice(0, idx + 1));
      }, idx * 260);
    });

    setTimeout(() => {
      setAuditPattern(preset.pattern);
      playSuccessSound(soundEnabled);
    }, full.length * 260 + 100);
  };

  const handleApplyPresetAsMaster = (preset: PatternPreset) => {
    onSaveMasterPattern(preset.pattern);
    playSuccessSound(soundEnabled);
    triggerHaptic('success', hapticsEnabled);
    setAuditPattern(preset.pattern);
    alert(`¡Patrón "${preset.name}" guardado como nuevo patrón de desbloqueo!`);
  };

  const handlePatternComplete = (pattern: number[]) => {
    if (activeTab === 'audit') {
      setAuditPattern(pattern);
      setAnimatingPreset(undefined);
      return;
    }

    // Setup Flow
    if (setupStep === 1) {
      if (pattern.length < 4) {
        setGridStatus('error');
        setSetupFeedback('Patrón muy corto. Conecta al menos 4 puntos.');
        playErrorSound(soundEnabled);
        triggerHaptic('error', hapticsEnabled);
        setTimeout(() => {
          setGridStatus('idle');
          setFirstPattern([]);
        }, 1200);
        return;
      }

      setFirstPattern(pattern);
      setGridStatus('success');
      setSetupFeedback('¡Patrón registrado! Ahora dibújalo de nuevo para confirmar.');
      playSuccessSound(soundEnabled);
      triggerHaptic('medium', hapticsEnabled);

      setTimeout(() => {
        setSetupStep(2);
        setGridStatus('idle');
      }, 900);
    } else {
      // Step 2: Confirm
      setSecondPattern(pattern);
      const isMatch = arePatternsEqual(firstPattern, pattern);

      if (isMatch) {
        setGridStatus('success');
        setSetupFeedback('¡Patrón confirmado y guardado con éxito!');
        playSuccessSound(soundEnabled);
        triggerHaptic('success', hapticsEnabled);
        onSaveMasterPattern(pattern);

        setTimeout(() => {
          setSetupStep(1);
          setFirstPattern([]);
          setSecondPattern([]);
          setGridStatus('idle');
          setSetupFeedback('Patrón maestro actualizado. Puedes configurar otro o probarlo.');
        }, 1600);
      } else {
        setGridStatus('error');
        setSetupFeedback('Los patrones no coinciden. Intenta de nuevo desde el paso 1.');
        playErrorSound(soundEnabled);
        triggerHaptic('error', hapticsEnabled);

        setTimeout(() => {
          setSetupStep(1);
          setFirstPattern([]);
          setSecondPattern([]);
          setGridStatus('idle');
          setSetupFeedback('Dibuja tu nuevo patrón (mínimo 4 nodos)');
        }, 1600);
      }
    }
  };

  const handleResetSetup = () => {
    setSetupStep(1);
    setFirstPattern([]);
    setSecondPattern([]);
    setGridStatus('idle');
    setSetupFeedback('Dibuja tu nuevo patrón (mínimo 4 nodos)');
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-2 px-3">
      {/* Tab Controls */}
      <div className="flex items-center justify-center mb-5">
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setActiveTab('charts');
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'charts'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Métricas & Gráficos</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setActiveTab('audit');
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Lienzo & Presets</span>
          </button>
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setActiveTab('setup');
              handleResetSetup();
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'setup'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Configurar Clave</span>
          </button>

          {onOpenSecurityApi && (
            <button
              onClick={() => {
                playClickSound(soundEnabled);
                onOpenSecurityApi();
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white shadow-sm active:scale-95 ml-auto"
              title="Modificar parámetros y políticas de la API de seguridad"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Modificar API de Seguridad</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'charts' ? (
        <PatternAnalyticsDashboard
          unlockAttempts={unlockAttempts}
          onRecordAttempt={onRecordAttempt}
          onClearAttempts={onClearAttempts}
          onSelectPatternForTest={(selectedPattern) => {
            setAuditPattern(selectedPattern);
            setActiveTab('audit');
          }}
          soundEnabled={soundEnabled}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Canvas */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {activeTab === 'setup' ? 'Establecer Clave de Patrón' : 'Lienzo de Análisis Libre'}
              </h2>
              <p className="text-xs text-slate-400">
                {activeTab === 'setup'
                  ? `Paso ${setupStep} de 2: ${setupStep === 1 ? 'Creación' : 'Confirmación'}`
                  : 'Dibuja cualquier trazo para evaluar su seguridad en vivo'}
              </p>
            </div>
            {activeTab === 'setup' && (
              <button
                onClick={handleResetSetup}
                title="Reiniciar"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Feedback banner */}
          <div
            className={`w-full py-2 px-3 rounded-xl text-xs mb-3 text-center font-medium transition-colors ${
              gridStatus === 'error'
                ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300'
                : gridStatus === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950 border border-slate-800 text-slate-300'
            }`}
          >
            {activeTab === 'setup' ? setupFeedback : 'Traza en el lienzo para auditar entropía y figuras comunes'}
          </div>

          {/* Pattern Canvas */}
          <div className="w-full flex justify-center py-2">
            <PatternGrid
              gridSize={gridSize}
              theme={theme}
              customStyle={customStyle}
              status={gridStatus}
              soundEnabled={soundEnabled}
              hapticsEnabled={hapticsEnabled}
              onPatternComplete={handlePatternComplete}
              highlightPattern={activeTab === 'audit' ? animatingPreset : undefined}
              showNumbers={showNumbers}
            />
          </div>

          {/* Sequence visual indicator */}
          <div className="w-full bg-slate-950/90 border border-slate-800/80 rounded-2xl p-3 mt-2">
            <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
              <span>Secuencia conectada</span>
              <span className="font-mono text-cyan-400 text-xs">
                {analyzedPattern.length} {analyzedPattern.length === 1 ? 'nodo' : 'nodos'}
              </span>
            </div>
            <div className="font-mono text-xs text-slate-200 tracking-wider min-h-[20px] flex items-center flex-wrap gap-1">
              {analyzedPattern.length > 0 ? (
                analyzedPattern.map((n, i) => (
                  <span key={i} className="inline-flex items-center">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">{n}</span>
                    {i < analyzedPattern.length - 1 && <span className="text-slate-600 mx-0.5">➔</span>}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 italic">Esperando trazo en el lienzo...</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Security Audit & Suggestions */}
        <div className="lg:col-span-6 space-y-4">
          {/* Security Score Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs text-slate-400 font-medium">Índice de Fortaleza Criptográfica</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-3xl font-extrabold font-mono tabular-nums ${securityReport.color}`}>
                    {securityReport.score}
                  </span>
                  <span className="text-xs text-slate-400">/ 100</span>
                  <span
                    className={`ml-2 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      securityReport.score >= 75
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : securityReport.score >= 50
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {securityReport.rating}
                  </span>
                </div>
              </div>

              {/* Entropy bit meter */}
              <div className="text-right">
                <span className="text-[11px] text-slate-400">Entropía Estimada</span>
                <div className="text-base font-bold text-white font-mono">{securityReport.entropyBits} bits</div>
                <div className="text-[10px] text-slate-500">Espacio: {securityReport.totalCombinations}</div>
              </div>
            </div>

            {/* Score progress bar */}
            <div className="w-full bg-slate-950 rounded-full h-2 mb-4 overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  securityReport.score >= 75 ? 'bg-cyan-400' : securityReport.score >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.max(5, securityReport.score)}%` }}
              />
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2">
                <div className="text-slate-400 text-[10px]">Longitud</div>
                <div className="text-white font-bold text-sm font-mono mt-0.5">{securityReport.length}</div>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2">
                <div className="text-slate-400 text-[10px]">Giros de Ángulo</div>
                <div className="text-white font-bold text-sm font-mono mt-0.5">{securityReport.directionChanges}</div>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2">
                <div className="text-slate-400 text-[10px]">Cruces / X</div>
                <div className="text-white font-bold text-sm font-mono mt-0.5">{securityReport.crossovers}</div>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2">
                <div className="text-slate-400 text-[10px]">Salto Caballo</div>
                <div className="text-white font-bold text-sm font-mono mt-0.5">{securityReport.knightMoves}</div>
              </div>
            </div>
          </div>

          {/* Warnings & Heuristics */}
          {securityReport.warnings.length > 0 && (
            <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Vulnerabilidades Detectadas</span>
              </div>
              <ul className="text-xs text-rose-200/90 space-y-1 pl-5 list-disc">
                {securityReport.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {securityReport.tips.length > 0 && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-bold">
                <Lightbulb className="w-4 h-4 shrink-0" />
                <span>Consejos de Blindaje Antiespionaje</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1 pl-5 list-disc">
                {securityReport.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preset Library (in Audit mode) */}
          {activeTab === 'audit' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Patrones Avanzados Recomendados</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Colección de geometrías resistentes a ataques de manchas de grasa en cristal (Smudge Attacks).
              </p>
              <div className="space-y-2">
                {PRESET_PATTERNS.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{preset.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {preset.difficulty}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{preset.description}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handlePreviewPreset(preset)}
                        title="Ver trazo"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1 text-xs"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Ver</span>
                      </button>
                      <button
                        onClick={() => handleApplyPresetAsMaster(preset)}
                        className="py-1.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors text-xs"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Link Card to Recharts Dashboard */}
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Telemetría de Patrones Recharts</div>
                    <div className="text-[11px] text-slate-400">Ver distribución de patrones y tasas de éxito/error</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    playClickSound(soundEnabled);
                    setActiveTab('charts');
                  }}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl text-xs transition-colors shrink-0"
                >
                  Ver Gráficos →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
