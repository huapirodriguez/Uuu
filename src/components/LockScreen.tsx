import React, { useState, useEffect } from 'react';
import { PatternGrid } from './PatternGrid.tsx';
import { CustomGridStyle, GridSize, ThemeConfig, UnlockAttempt } from '../types.ts';
import { arePatternsEqual } from '../utils/patternLogic.ts';
import { playClickSound, playErrorSound, playLockSound, playSuccessSound, triggerHaptic } from '../utils/sound.ts';
import { Lock, Unlock, ShieldAlert, PhoneCall, Bell, Sparkles, RefreshCw, KeyRound, Eye, EyeOff, Cable, Usb, Bot } from 'lucide-react';

interface LockScreenProps {
  masterPattern: number[];
  gridSize: GridSize;
  theme: ThemeConfig;
  hideTrail: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  showNumbers: boolean;
  customStyle?: Partial<CustomGridStyle>;
  pairedDevice?: string | null;
  onUnlockSuccess: () => void;
  onRecordAttempt: (attempt: Omit<UnlockAttempt, 'id' | 'timestamp'>) => void;
  onOpenSettings: () => void;
  onOpenPhoneConnect?: () => void;
  onOpenAgent?: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  masterPattern,
  gridSize,
  theme,
  hideTrail,
  soundEnabled,
  hapticsEnabled,
  showNumbers,
  customStyle,
  pairedDevice,
  onUnlockSuccess,
  onRecordAttempt,
  onOpenSettings,
  onOpenPhoneConnect,
  onOpenAgent,
}) => {
  const [status, setStatus] = useState<'idle' | 'drawing' | 'success' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('Dibuja el patrón para desbloquear');
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutTime, setLockoutTime] = useState<number>(0);
  const [showHintModal, setShowHintModal] = useState<boolean>(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [tempHideTrail, setTempHideTrail] = useState<boolean>(hideTrail);

  // Sync tempHideTrail with prop
  useEffect(() => {
    setTempHideTrail(hideTrail);
  }, [hideTrail]);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTime <= 0) return;
    const interval = setInterval(() => {
      setLockoutTime((prev) => {
        if (prev <= 1) {
          setFeedbackMessage('Dibuja el patrón para desbloquear');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime]);

  const handlePatternComplete = (pattern: number[]) => {
    if (lockoutTime > 0) return;

    if (pattern.length < 4) {
      setStatus('error');
      setFeedbackMessage('Patrón demasiado corto (mínimo 4 puntos)');
      playErrorSound(soundEnabled);
      triggerHaptic('error', hapticsEnabled);
      setTimeout(() => {
        setStatus('idle');
        setFeedbackMessage('Dibuja el patrón para desbloquear');
      }, 1400);
      return;
    }

    const isMatch = arePatternsEqual(pattern, masterPattern);

    if (isMatch) {
      setStatus('success');
      setFeedbackMessage('¡Dispositivo desbloqueado!');
      setFailedAttempts(0);
      playSuccessSound(soundEnabled);
      triggerHaptic('success', hapticsEnabled);

      onRecordAttempt({
        success: true,
        length: pattern.length,
        patternMasked: pattern.map(() => '●').join(''),
        deviceInfo: 'Biometría por Patrón',
      });

      setTimeout(() => {
        onUnlockSuccess();
      }, 700);
    } else {
      const newFails = failedAttempts + 1;
      setFailedAttempts(newFails);
      setStatus('error');
      playErrorSound(soundEnabled);
      triggerHaptic('error', hapticsEnabled);

      onRecordAttempt({
        success: false,
        length: pattern.length,
        patternMasked: pattern.map(() => '●').join(''),
        deviceInfo: 'Intento no autorizado',
      });

      if (newFails >= 5) {
        setLockoutTime(30);
        setFeedbackMessage('Demasiados intentos. Bloqueado por 30s.');
      } else {
        const remaining = 5 - newFails;
        setFeedbackMessage(`Patrón incorrecto. Te quedan ${remaining} ${remaining === 1 ? 'intento' : 'intentos'}.`);
        setTimeout(() => {
          setStatus('idle');
          setFeedbackMessage('Dibuja el patrón para desbloquear');
        }, 1500);
      }
    }
  };

  // Format date in Spanish
  const dateStr = currentTime.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const capitalizedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  const timeStr = currentTime.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div className="flex flex-col items-center justify-between min-h-[580px] w-full max-w-sm mx-auto px-4 py-3 select-none">
      {/* Top Lock Screen Status & Clock */}
      <div className="w-full flex flex-col items-center pt-2">
        {/* Status bar */}
        <div className="w-full flex items-center justify-between text-xs text-slate-400 px-2 mb-3">
          <div className="flex items-center gap-1.5 font-medium">
            <span>PatternOS</span>
            {pairedDevice?.includes('USB') ? (
              <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-0.5">
                <Cable className="w-3 h-3" /> USB
              </span>
            ) : (
              <span className="text-[10px] text-cyan-400 font-mono">5G</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTempHideTrail(!tempHideTrail)}
              title={tempHideTrail ? 'Trazo oculto (Privado)' : 'Trazo visible'}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              {tempHideTrail ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <span className="font-mono text-xs">89%</span>
            <div className="w-5 h-2.5 border border-slate-400 rounded-sm p-0.5 flex items-center">
              <div className="w-3.5 h-full bg-cyan-400 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* Lock icon */}
        <div className="mb-2">
          {status === 'success' ? (
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
              <Unlock className="w-5 h-5 animate-bounce" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-800/80 text-slate-300 flex items-center justify-center border border-slate-700">
              <Lock className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* Time and Date */}
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white font-mono tabular-nums">
          {timeStr}
        </h1>
        <p className="text-xs md:text-sm text-slate-300 font-medium mt-1">
          {capitalizedDate}
        </p>

        {/* Dynamic status feedback pill */}
        <div className="mt-3 min-h-[28px] flex items-center justify-center">
          {lockoutTime > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs rounded-full">
              <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
              <span>Bloqueado: espera {lockoutTime}s</span>
            </div>
          ) : (
            <div
              className={`text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                status === 'error'
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-500/50'
                  : status === 'success'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50'
                  : 'bg-slate-900/80 text-slate-300 border border-slate-800'
              }`}
            >
              <span>{feedbackMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Center Interactive Pattern Grid */}
      <div className="w-full my-auto py-2">
        <PatternGrid
          gridSize={gridSize}
          theme={theme}
          customStyle={customStyle}
          status={status}
          hideTrail={tempHideTrail}
          soundEnabled={soundEnabled}
          hapticsEnabled={hapticsEnabled}
          disabled={lockoutTime > 0 || status === 'success'}
          onPatternComplete={handlePatternComplete}
          showNumbers={showNumbers}
        />
      </div>

      {/* Notification preview pill */}
      <div
        onClick={onOpenPhoneConnect}
        className="w-full bg-slate-900/70 hover:bg-slate-900/90 cursor-pointer backdrop-blur-md border border-slate-800/80 hover:border-cyan-500/40 rounded-2xl p-2.5 mb-3 transition-colors"
      >
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <div className="flex items-center gap-1.5">
            {pairedDevice?.includes('USB') ? (
              <Cable className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Bell className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span className="font-semibold text-slate-200">
              {pairedDevice ? 'Teléfono Vinculado Activo' : 'Enlace con Teléfono (USB / QR)'}
            </span>
          </div>
          <span className="text-[10px] text-cyan-400">
            {pairedDevice ? 'En línea' : 'Conectar'}
          </span>
        </div>
        <p className="text-xs text-slate-300 truncate">
          {pairedDevice
            ? `Canal seguro activo con ${pairedDevice} · Latencia < 2ms`
            : 'Conecta tu teléfono por cable USB o QR para desbloquear remotamente.'}
        </p>
      </div>

      {/* Bottom Emergency, Agent & Help Actions */}
      <div className="w-full flex items-center justify-between px-1 pt-1.5 border-t border-slate-800/80 text-xs text-slate-400">
        <button
          onClick={() => setShowEmergencyModal(true)}
          className="flex items-center gap-1.5 py-1.5 px-2 hover:text-rose-400 transition-colors"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Emergencia</span>
        </button>

        {onOpenAgent && (
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              onOpenAgent();
            }}
            className="flex items-center gap-1.5 py-1.5 px-2.5 bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 rounded-xl font-semibold transition-all shadow-sm active:scale-95"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Agente IA</span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 py-1.5 px-2 hover:text-cyan-400 transition-colors font-medium text-slate-300"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Personalizar</span>
        </button>

        <button
          onClick={() => setShowHintModal(true)}
          className="flex items-center gap-1.5 py-1.5 px-2 hover:text-cyan-400 transition-colors"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Pista</span>
        </button>
      </div>

      {/* Emergency Dial Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-xs w-full text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Llamada de Emergencia</h3>
            <p className="text-xs text-slate-400 mb-4">
              Números de socorro simulados en la terminal móvil.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4 font-mono text-base font-semibold text-white">
              {['911', '112', '066', 'Policía', 'Bomberos', 'Médico'].map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    playSuccessSound(soundEnabled);
                    alert(`Simulando llamada a servicio de emergencia: ${item}`);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl text-xs active:scale-95 transition-transform"
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowEmergencyModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Hint & Pattern Demo Modal */}
      {showHintModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full">
            <div className="flex items-center gap-2 mb-2 text-cyan-400">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Pista del Patrón Maestro</h3>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              El patrón actual guardado conecta {masterPattern.length} puntos.
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center mb-4">
              <div className="text-xs text-slate-400 mb-1">Secuencia de nodos (0-indexada):</div>
              <div className="font-mono text-cyan-400 font-semibold tracking-wider text-sm">
                {masterPattern.join(' ➔ ')}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowHintModal(false);
                  handlePatternComplete(masterPattern);
                }}
                className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold"
              >
                Auto-desbloquear
              </button>
              <button
                onClick={() => setShowHintModal(false)}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
