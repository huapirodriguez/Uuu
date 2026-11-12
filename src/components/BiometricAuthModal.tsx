import React, { useState, useEffect, useRef } from 'react';
import {
  Fingerprint,
  Scan,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Lock,
  Unlock,
  KeyRound,
  RotateCcw,
  Sliders,
  Smartphone,
  Eye,
  Camera,
} from 'lucide-react';
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/sound.ts';

interface BiometricAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  soundEnabled: boolean;
  title?: string;
  subtitle?: string;
}

export type BiometricMode = 'fingerprint' | 'face';
export type BiometricStatus = 'idle' | 'scanning' | 'success' | 'error';

export const BiometricAuthModal: React.FC<BiometricAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  soundEnabled,
  title = 'Verificación Biométrica Requerida',
  subtitle = 'Escanea tu huella dactilar o reconocimiento facial para acceder a los ajustes sensibles del sistema.',
}) => {
  const [mode, setMode] = useState<BiometricMode>('fingerprint');
  const [status, setStatus] = useState<BiometricStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rememberInSession, setRememberInSession] = useState(true);

  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setProgress(0);
      setErrorMessage(null);
    } else {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerScan = (forcedOutcome?: 'success' | 'fail') => {
    if (status === 'scanning' || status === 'success') return;

    playClickSound(soundEnabled);
    setStatus('scanning');
    setProgress(0);
    setErrorMessage(null);

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 12;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setProgress(100);

        const willSucceed = forcedOutcome ? forcedOutcome === 'success' : true;

        if (willSucceed) {
          setStatus('success');
          playSuccessSound(soundEnabled);
          if (rememberInSession) {
            try {
              sessionStorage.setItem('patternlock_biometric_verified', String(Date.now()));
            } catch {}
          }
          setTimeout(() => {
            onSuccess();
          }, 800);
        } else {
          setStatus('error');
          playErrorSound(soundEnabled);
          setAttempts((prev) => prev + 1);
          setErrorMessage(
            mode === 'fingerprint'
              ? 'Huella dactilar no reconocida. Limpia el sensor y vuelve a intentarlo.'
              : 'Rostro no detectado con suficiente iluminación. Enfoca la cámara de frente.'
          );
        }
      } else {
        setProgress(currentProgress);
      }
    }, 60);

    scanIntervalRef.current = interval;
  };

  const handleTouchStart = () => {
    triggerScan('success');
  };

  const handleSimulateFailure = () => {
    triggerScan('fail');
  };

  const handleSimulateSuccess = () => {
    triggerScan('success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl shadow-cyan-950/60 p-6 flex flex-col items-center text-center text-slate-100 overflow-hidden">
        {/* Glow ambient circle */}
        <div
          className={`absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
            status === 'success'
              ? 'bg-emerald-500/25'
              : status === 'error'
              ? 'bg-rose-500/25'
              : status === 'scanning'
              ? 'bg-cyan-500/25'
              : 'bg-indigo-500/15'
          }`}
        />

        {/* Close Button */}
        <button
          onClick={() => {
            playClickSound(soundEnabled);
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Cancelar autenticación"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-400 mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>AUTENTICACIÓN BIOMÉTRICA DE SEGURIDAD</span>
        </div>

        <h3 className="text-base font-extrabold text-white tracking-tight">{title}</h3>
        <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">{subtitle}</p>

        {/* Biometric Mode Selector Tabs (Huella vs Rostro) */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs my-4 w-full max-w-xs">
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setMode('fingerprint');
              setStatus('idle');
              setProgress(0);
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 px-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'fingerprint'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Huella Dactilar</span>
          </button>

          <button
            onClick={() => {
              playClickSound(soundEnabled);
              setMode('face');
              setStatus('idle');
              setProgress(0);
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 px-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'face'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Face ID / Rostro</span>
          </button>
        </div>

        {/* Main Interactive Scanner Visual Area */}
        <div className="relative my-2 flex items-center justify-center">
          {/* Circular Progress Ring */}
          <svg className="w-40 h-40 -rotate-90 transform" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="52"
              className="stroke-slate-800"
              strokeWidth="5"
              fill="transparent"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              className={`transition-all duration-150 ${
                status === 'success'
                  ? 'stroke-emerald-400'
                  : status === 'error'
                  ? 'stroke-rose-400'
                  : 'stroke-cyan-400'
              }`}
              strokeWidth="6"
              strokeDasharray={326.7}
              strokeDashoffset={326.7 - (326.7 * progress) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Interactive Pad Button */}
          <button
            onClick={handleTouchStart}
            disabled={status === 'scanning' || status === 'success'}
            className={`absolute w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 active:scale-95 group focus:outline-none ${
              status === 'success'
                ? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 shadow-xl shadow-emerald-950/50'
                : status === 'error'
                ? 'bg-rose-500/20 border-2 border-rose-400 text-rose-300 shadow-xl shadow-rose-950/50 animate-shake'
                : status === 'scanning'
                ? 'bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 animate-pulse'
                : 'bg-slate-950 hover:bg-slate-800 border-2 border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-white shadow-xl'
            }`}
            title="Toca para verificar identidad biométrica"
          >
            {status === 'success' ? (
              <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
            ) : mode === 'fingerprint' ? (
              <div className="relative flex items-center justify-center">
                <Fingerprint className="w-12 h-12 transition-transform group-hover:scale-105" />
                {status === 'scanning' && (
                  <div className="absolute inset-x-0 h-1 bg-cyan-400 rounded-full animate-laserScan shadow-lg shadow-cyan-400" />
                )}
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                <Scan className="w-12 h-12 transition-transform group-hover:scale-105" />
                {status === 'scanning' && (
                  <div className="absolute inset-0 border-2 border-cyan-400/80 rounded-2xl animate-ping" />
                )}
              </div>
            )}

            <span className="text-[10px] font-bold mt-1 tracking-tight font-sans">
              {status === 'success'
                ? '¡VERIFICADO!'
                : status === 'scanning'
                ? `${progress}%`
                : status === 'error'
                ? 'FALLIDO'
                : 'TOCAR AQUÍ'}
            </span>
          </button>
        </div>

        {/* Status prompt */}
        <div className="mt-2 text-xs font-semibold">
          {status === 'idle' && (
            <p className="text-slate-300">
              Presiona el sensor central para simular lectura de {mode === 'fingerprint' ? 'huella' : 'rostro'}
            </p>
          )}
          {status === 'scanning' && (
            <p className="text-cyan-400 flex items-center justify-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Verificando plantilla biométrica en enclave seguro...</span>
            </p>
          )}
          {status === 'success' && (
            <p className="text-emerald-400 font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Identidad biométrica confirmada. Abriendo ajustes...</span>
            </p>
          )}
          {status === 'error' && (
            <p className="text-rose-400 font-bold flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}
        </div>

        {/* QA Testing Controls (Success vs Error Simulator) */}
        <div className="w-full mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Simulador de Casos QA:</span>
            <label className="flex items-center gap-1 cursor-pointer select-none text-[10px] text-slate-400 hover:text-white">
              <input
                type="checkbox"
                checked={rememberInSession}
                onChange={(e) => setRememberInSession(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 w-3 h-3"
              />
              <span>Recordar 5 min</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={handleSimulateSuccess}
              disabled={status === 'scanning' || status === 'success'}
              className="py-2 px-3 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simular Éxito</span>
            </button>

            <button
              onClick={handleSimulateFailure}
              disabled={status === 'scanning' || status === 'success'}
              className="py-2 px-3 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Simular Fallo</span>
            </button>
          </div>

          {/* Emergency Fallback button */}
          <button
            onClick={() => {
              playClickSound(soundEnabled);
              onSuccess();
            }}
            className="text-[11px] text-slate-400 hover:text-cyan-300 underline pt-1 font-medium"
          >
            Omitir con Patrón Maestro de Emergencia →
          </button>
        </div>
      </div>
    </div>
  );
};
